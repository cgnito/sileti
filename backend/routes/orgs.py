from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
import logging

import models
import schemas
import utils
import security
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orgs", tags=["Organizations"])


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


# REGISTER SCHOOL (PUBLIC ENDPOINT)
@router.post("", status_code=status.HTTP_201_CREATED)
def register_school(
    org_input: schemas.OrgCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
): 
    # Normalization Guard: Enforce case-insensitive email constraints globally
    normalized_email = org_input.admin_email.strip().lower() if org_input.admin_email else ""

    # Concurrency & Duplicate Guard: Check if the Admin's email is already registered anywhere in the system
    if db.query(models.User).filter(models.User.email == normalized_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An administrator account with this email address already exists."
        )

    # 1. Create the Master Organization Profile
    new_org = models.Organization(
        name=org_input.name,
        short_code=org_input.short_code,
        slug=org_input.slug,
        settings=org_input.settings
    )
    db.add(new_org)
    db.flush() # Flushes to database to generate the new_org.id without committing the transaction yet

    # 2. Automatically generate the initial Master Administrator Account bound to this organization
    hashed_password = security.get_password_hash(org_input.admin_password)
    new_admin = models.User(
        email=normalized_email,  # Insert safely normalized lowercase variant
        password_hash=hashed_password,
        role=models.UserRole.ADMIN,
        org_id=new_org.id,
        is_active=False # Account stays locked until email verification loop completes successfully
    )
    db.add(new_admin)
    db.commit()

    # 3. Generate verification token and handoff email delivery execution to background worker processes
    token = security.create_verification_token(new_admin.email)
    background_tasks.add_task(send_verification_email_task, new_admin.email, token)

    return {"message": "Registration successful! Please verify your email via the link sent."}



# GET CURRENT SCHOOL INFO (ADMIN ONLY)
@router.get("/my-school", response_model=schemas.OrgResponse)
def get_my_school(
    current_admin: models.User = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    # returns the organization linked to the active Admin account
    if not current_admin.organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Organization not found"
        )
    return current_admin.organization


# UPDATE SCHOOL DETAILS (ADMIN ONLY)
@router.patch("/my-school", response_model=schemas.OrgResponse)
def update_my_school(
    org_update: schemas.OrgUpdate,
    current_admin: models.User = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    org = current_admin.organization
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Organization not found"
        )

    update_data = org_update.model_dump(exclude_unset=True)

    # Logic Patch: Only generate a new URL-friendly slug IF they are explicitly altering the school's name
    if "name" in update_data and update_data["name"]:
        # Standard utility replacement pattern to maintain clean routing paths
        update_data["slug"] = update_data["name"].lower().replace(" ", "-")

    for key, value in update_data.items():
        setattr(org, key, value)

    db.commit()
    db.refresh(org)
    return org