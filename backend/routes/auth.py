from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import logging

import models
import security
import schemas
import utils
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])


# USER LOGIN / TOKEN GENERATION (PUBLIC ENDPOINT)
@router.post("/auth/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), \
    db: Session = Depends(get_db)
):
    # Normalize input email string to lowercase to ensure case-insensitive matching
    login_email = form_data.username.lower().strip() if form_data.username else ""
    
    # Search for user by email address
    user = db.query(models.User).filter(models.User.email == login_email).first()
    
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
            detail="Invalid or expired token"
        )

    # Normalize the decoded token email just in case legacy database values hold mixed text formatting
    verification_email = email.lower().strip() if email else ""

    user = db.query(models.User).filter(models.User.email == verification_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )

    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has already been used."
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


# BACKGROUND TASK: Send Verification Email
def send_verification_email_task(email: str, token: str):
    """
    Background task to send verification email.
    Wrapped in try/except to prevent crashes if email fails.
    """
    try:
        utils.send_verification_email(email, token)
        logger.info(f"Verification email sent successfully to {email}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {str(e)}")


# RESEND VERIFICATION EMAIL (PUBLIC)
@router.post("/resend-verification")
def resend_verification_email(
    email_data: schemas.ResendEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Resend verification email to a user who hasn't verified their account.
    Only sends if user exists and is_active is False.
    Uses BackgroundTasks so the response returns immediately without waiting for email send.
    """
    # Normalize user input string before execution querying routines
    target_email = email_data.email.lower().strip() if email_data.email else ""
    
    user = db.query(models.User).filter(models.User.email == target_email).first()
    
    if not user:
        # Don't reveal whether email exists (security best practice)
        return {"message": "If this email is registered, a verification link has been sent."}
    
    # Only allow resend if account hasn't been verified yet
    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is already verified. Please log in."
        )
    
    # Generate a fresh verification token
    token = security.create_verification_token(user.email)
    
    # Add email sending to background tasks - request returns immediately
    background_tasks.add_task(send_verification_email_task, user.email, token)
    
    # Return success immediately without waiting for email
    return {"message": "If this email is registered, a verification link has been sent."}