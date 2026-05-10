from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt


import models
import security
import schemas  
from database import get_db

router = APIRouter(tags=["Authentication"])


# USER LOGIN / TOKEN GENERATION (PUBLIC ENDPOINT)
@router.post("/auth/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    # Search for user by email address
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    # Secure validation check (fails identically for both bad email and bad password to prevent enumeration)
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Incorrect email or password"
        )
    
    # Enforce email/account activation checks
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Please verify your email address to activate your account."
        )
    
    # Generate JWT holding user subject identifier and authority role
    access_token = security.create_access_token(
        data={"sub": user.email, "role": user.role.value}
    )
    return {"access_token": access_token, "token_type": "bearer"}



# EMAIL VERIFICATION / REGISTRATION ACTIVATION (PUBLIC)
@router.get("/verify")
def verify_email(
    token: str, 
    db: Session = Depends(get_db)
):
    try:
        # Decode the invitation token using security configurations
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email: str = payload.get("sub")
        
        # Verify that this token is strictly for verification, not access
        if email is None or payload.get("purpose") != "verification":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Invalid token purpose"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Token has expired or is invalid"
        )

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user: 
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    
    # Activate user account
    user.is_active = True
    db.commit()
    return {"message": "Account activated successfully!"}


# GET LOGGED-IN USER PROFILE (SECURED)
@router.get("/users/me", response_model=schemas.UserResponse)
def read_current_user(
    current_user: models.User = Depends(security.get_current_user)
):
    """
    Returns the identity profile of the currently authenticated active session.
    Highly necessary for frontend dashboard routing and user-state initialization.
    """
    return current_user