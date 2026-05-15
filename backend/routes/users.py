from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import logging

import models
import schemas
import security
import utils
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["User Management"])


# BACKGROUND TASK: Send Staff Invitation Email
def send_staff_invitation_task(email: str, token: str, admin_name: str, org_name: str):
    """
    Background task to send staff invitation email.
    Wrapped in try/except to prevent crashes if email fails.
    """
    try:
        utils.send_staff_invitation_email(
            email=email,
            token=token,
            admin_name=admin_name,
            org_name=org_name
        )
        logger.info(f"Staff invitation email sent successfully to {email}")
    except Exception as e:
        logger.error(f"Failed to send invitation email to {email}: {str(e)}")


# INVITE STAFF MEMBER (ADMIN ONLY)
@router.post("/staff", status_code=status.HTTP_201_CREATED)
def add_staff_member(
    user_in: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(security.allow_admin_only)
):
    # Verify that the invited email isn't already registered
    if db.query(models.User).filter(models.User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="User with this email already exists"
        )

    # Create user but keep them inactive until they set a password
    new_staff = models.User(
        full_name=user_in.full_name,
        email=user_in.email,
        password_hash="INVITED_USER_PENDING", 
        role=user_in.role,
        org_id=current_admin.org_id,
        is_active=False 
    )
    
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)

    # Generate invitation token
    token = security.create_verification_token(new_staff.email)
    
    # Add email sending to background tasks - request returns immediately
    background_tasks.add_task(
        send_staff_invitation_task,
        new_staff.email,
        token,
        current_admin.full_name,
        current_admin.organization.name
    )

    return {"message": f"Invitation sent to {user_in.email}"}



# SET PASSWORD (PUBLIC / PENDING STAFF)
@router.post("/set-password")
def set_password(
    data: schemas.SetPassword, 
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(data.token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email = payload.get("sub")
        if email is None or payload.get("purpose") != "verification":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link has already been used. Please log in or use 'Forgot Password'."
        )

    # 2. Assign the secure password hash and activate
    user.password_hash = security.get_password_hash(data.new_password)
    user.is_active = True
    db.commit()

    return {"message": "Password set successfully. You can now log in."}


# GET STAFF LIST (ADMIN ONLY)
@router.get("/staff", response_model=list[schemas.UserResponse])
def get_staff_list(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(security.allow_admin_only)
):
    # Fetch all users belonging strictly to the Admin's organization
    staff = db.query(models.User).filter(
        models.User.org_id == current_admin.org_id
    ).all()
    return staff



# 4. UPDATE STAFF PROFILE (ADMIN ONLY) - PATCH
@router.patch("/staff/{user_id}", response_model=schemas.UserResponse)
def update_staff_member(
    user_id: UUID,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(security.allow_admin_only)
):
    # Query user inside the admin's own organization namespace to guarantee isolation
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.org_id == current_admin.org_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Staff member not found"
        )

    update_data = user_update.model_dump(exclude_unset=True)

    # If email is being updated, perform safety checks
    if "email" in update_data:
        existing = db.query(models.User).filter(
            models.User.email == update_data["email"],
            models.User.id != user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Email is already in use"
            )

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user



# REMOVE STAFF MEMBER (ADMIN ONLY)
@router.delete("/staff/{user_id}")
def remove_staff_member(
    user_id: UUID, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(security.allow_admin_only)
):
    # Retrieve user and guarantee isolation boundary
    user = db.query(models.User).filter(
        models.User.id == user_id, 
        models.User.org_id == current_admin.org_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Staff member not found"
        )
    
    # Self-deletion prevention guardrail
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="You cannot delete yourself!"
        )

    db.delete(user)
    db.commit()
    return {"message": f"Staff member {user.full_name} has been removed successfully."}


# RESEND INVITATION EMAIL TO STAFF (ADMIN ONLY)
@router.post("/staff/{user_id}/resend-invite")
def resend_staff_invitation(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(security.allow_admin_only)
):
    """
    Resend invitation email to a staff member who hasn't yet set their password.
    Only works if the staff member is in the admin's organization and is_active is False.
    Uses BackgroundTasks so the response returns immediately without waiting for email send.
    """
    # Retrieve staff member, ensuring they belong to the admin's organization
    staff_member = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.org_id == current_admin.org_id
    ).first()

    if not staff_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found"
        )

    # Only allow resend if account hasn't been activated yet
    if staff_member.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This staff member has already activated their account"
        )

    # Generate a fresh invitation token
    token = security.create_verification_token(staff_member.email)

    # Add email sending to background tasks - request returns immediately
    background_tasks.add_task(
        send_staff_invitation_task,
        staff_member.email,
        token,
        current_admin.full_name,
        current_admin.organization.name
    )

    return {"message": f"Invitation resent to {staff_member.email}"}