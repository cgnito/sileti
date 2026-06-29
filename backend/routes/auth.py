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


def send_verification_email_task(email: str, token: str):
    # background task mapping for registration callbacks
    try:
        utils.send_verification_email(email, token)
        logger.info(f"successfully resent verification email to {email}")
    except Exception as e:
        logger.error(f"failed to send verification email to {email}: {str(e)}")


# email verification / registration activation (public - school organization only)
@router.get("/verify")
def verify_email(
    token: str, 
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email: str = payload.get("sub")
        
        if email is None or payload.get("purpose") != "verification":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="invalid token purpose"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="the verification link is invalid or has expired"
        )

    # strictly check and verify the school organization table
    org = db.query(models.Organization).filter(models.Organization.school_email == email).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="school organization profile not found"
        )

    if org.is_verified:
        return {"message": "school account is already verified. please log in."}

    # activate the school profile tracking state
    org.is_verified = True
    db.commit()
    return {"message": "school email verification successful. your account is now active."}


# unified login endpoint supporting both school admin table and staff user table
@router.post("/auth/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    login_email = form_data.username.lower().strip() if form_data.username else ""
    
    # step 1: check if the credentials belong to a school admin in organizations table
    org = db.query(models.Organization).filter(models.Organization.school_email == login_email).first()
    if org and security.verify_password(form_data.password, org.hashed_password):
        if not org.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="school account is unverified. please verify your email address."
            )
        
        token_payload = {
            "sub": org.school_email, 
            "role": "admin", 
            "org_id": str(org.id)
        }
        access_token = security.create_access_token(data=token_payload)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": "admin",
            "org_id": org.id
        }

    # step 2: check if the credentials belong to a staff member in the users table
    user = db.query(models.User).filter(models.User.email == login_email).first()
    if user and security.verify_password(form_data.password, user.password_hash):
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="staff account is inactive. please set your password using your invite link."
            )

        token_payload = {
            "sub": user.email, 
            "role": str(user.role).lower(), 
            "org_id": str(user.org_id)
        }
        access_token = security.create_access_token(data=token_payload)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": str(user.role).lower(),
            "org_id": user.org_id
        }

    # step 3: fail identically if neither table yields a match to stop enumeration
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, 
        detail="incorrect email or password"
    )


# resend verification links (public - school organization only)
@router.post("/auth/resend-verification")
def resend_verification_email(
    email_data: schemas.ResendEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    target_email = email_data.email.lower().strip() if email_data.email else ""
    
    # query school organization table exclusively
    org = db.query(models.Organization).filter(models.Organization.school_email == target_email).first()
    if not org:
        # standard obfuscation mask response to protect account security
        return {"message": "if this email is registered, a verification link has been sent."}
    
    if org.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="this school account is already verified. please log in."
        )
    
    token = security.create_verification_token(org.school_email)
    background_tasks.add_task(send_verification_email_task, org.school_email, token)
    
    return {"message": "if this email is registered, a verification link has been sent."}