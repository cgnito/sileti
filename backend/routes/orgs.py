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

def send_verification_email_task(email: str, token: str):
    # background wrapper for non-blocking email deployment
    try:
        utils.send_verification_email(email, token)
        logger.info(f"successfully sent verification email to {email}")
    except Exception as e:
        logger.error(f"failed to send verification email to {email}: {str(e)}")



@router.post("", status_code=status.HTTP_201_CREATED)
def register_school(
    org_input: schemas.OrgCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
): 
    # normalize entry inputs to secure database consistency
    normalized_email = org_input.school_email.lower().strip() if org_input.school_email else ""

    # auto-generate short code using utility if not explicitly provided by the user
    if not org_input.short_code or not org_input.short_code.strip():
        generated_code = utils.generate_short_code(org_input.school_name)
    else:
        generated_code = org_input.short_code

    normalized_code = generated_code.upper().strip()

    # block email collision across schools
    if db.query(models.Organization).filter(models.Organization.school_email == normalized_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="a school with this email already exists"
        )

    # block code duplicate entries using the evaluated code string
    if db.query(models.Organization).filter(models.Organization.short_code == normalized_code).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="a school with this short code already exists. try specifying a custom short code."
        )

    # auto-generate lowercase hyphenated slug from school name fallback string
    generated_slug = org_input.school_name.lower().replace(" ", "-").strip("-")

    new_org = models.Organization(
        school_name=org_input.school_name,
        short_code=normalized_code,
        school_email=normalized_email,
        hashed_password=security.get_password_hash(org_input.password),
        slug=generated_slug
    )
    
    db.add(new_org)
    db.commit()
    db.refresh(new_org)

    # non-blocking verification token transmission
    token = security.create_verification_token(new_org.school_email)
    background_tasks.add_task(send_verification_email_task, new_org.school_email, token)

    return {
        "message": "school registration successful. verification email sent.",
        "role": "admin",
        "org_id": str(new_org.id)
    }



@router.get("/my-school", response_model=schemas.OrgResponse)
def get_my_school(
    current_admin: security.AuthContext = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    # pull linked object data from current admin session context
    if not current_admin.organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="organization profile record missing"
        )
    return current_admin.organization



@router.patch("/my-school", response_model=schemas.OrgResponse)
def update_my_school(
    org_update: schemas.OrgUpdate,
    current_admin: security.AuthContext = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    org = current_admin.organization
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="organization profile record missing"
        )

    update_data = org_update.model_dump(exclude_unset=True)

    # maintain clean routing slugs dynamically if the name modifies
    if "school_name" in update_data and update_data["school_name"]:
        update_data["slug"] = update_data["school_name"].lower().replace(" ", "-").strip("-")

    for key, value in update_data.items():
        setattr(org, key, value)

    db.commit()
    db.refresh(org)
    return org