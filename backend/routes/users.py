from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import logging

from app import models, security
from services import utils
import schemas
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["User Management"])


# background task: dispatch staff email invitation link cleanly
def send_staff_invitation_task(email: str, token: str, admin_name: str, org_name: str):
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


# invite staff member (access: admin only)
@router.post("/staff", status_code=status.HTTP_201_CREATED)
def add_staff_member(
    user_in: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: security.AuthContext = Depends(security.allow_admin_only)
):
    normalized_email = user_in.email.strip().lower()

    if db.query(models.User).filter(models.User.email == normalized_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="User with this email already exists"
        )

    # force role parameter string value to match staff designation perfectly
    new_staff = models.User(
        full_name=user_in.full_name,
        email=normalized_email,
        password_hash="INVITED_USER_PENDING", 
        role="staff", 
        org_id=current_admin.org_id,
        is_active=False 
    )
    
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)

    token = security.create_verification_token(new_staff.email)
    
    background_tasks.add_task(
        send_staff_invitation_task,
        new_staff.email,
        token,
        current_admin.full_name,
        current_admin.organization.school_name
    )

    return {"message": f"Invitation sent to {normalized_email}"}


# public route: verify token and set password (access: public)
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

    user.password_hash = security.get_password_hash(data.new_password)
    user.is_active = True
    db.commit()

    return {"message": "Password set successfully. You can now log in."}


# get all staff members (access: admin only)
@router.get("/staff", response_model=list[schemas.UserResponse])
def get_staff_list(
    db: Session = Depends(get_db),
    current_admin: security.AuthContext = Depends(security.allow_admin_only)
):
    return db.query(models.User).filter(
        models.User.org_id == current_admin.org_id
    ).all()


# update staff member details (access: admin only)
@router.patch("/staff/{user_id}", response_model=schemas.UserResponse)
def update_staff_member(
    user_id: UUID,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_admin: security.AuthContext = Depends(security.allow_admin_only)
):
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

    if "email" in update_data:
        update_data["email"] = update_data["email"].strip().lower()
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


# remove staff member (access: admin only)
@router.delete("/staff/{user_id}")
def remove_staff_member(
    user_id: UUID, 
    db: Session = Depends(get_db),
    current_admin: security.AuthContext = Depends(security.allow_admin_only)
):
    user = db.query(models.User).filter(
        models.User.id == user_id, 
        models.User.org_id == current_admin.org_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Staff member not found"
        )

    db.delete(user)
    db.commit()
    return {"message": f"Staff member {user.full_name} has been removed successfully."}


# resend invitation link (access: admin only)
@router.post("/staff/{user_id}/resend-invite")
def resend_staff_invitation(
    user_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: security.AuthContext = Depends(security.allow_admin_only)
):
    staff_member = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.org_id == current_admin.org_id
    ).first()

    if not staff_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found"
        )

    if staff_member.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This staff member has already activated their account"
        )

    token = security.create_verification_token(staff_member.email)

    background_tasks.add_task(
        send_staff_invitation_task,
        staff_member.email,
        token,
        current_admin.full_name,
        current_admin.organization.school_name
    )

    return {"message": f"Invitation resent to {staff_member.email}"}