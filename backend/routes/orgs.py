from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session


import models
import schemas
import utils
import security
from database import get_db

router = APIRouter(prefix="/orgs", tags=["Organizations"])



# REGISTER SCHOOL (PUBLIC ENDPOINT)
@router.post("", status_code=status.HTTP_201_CREATED)
def register_school(
    org_input: schemas.OrgCreate, 
    db: Session = Depends(get_db)
): 
    #check if the Admin's email is already registered anywhere in the system
    if db.query(models.User).filter(models.User.email == org_input.admin_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email already registered"
        )

    #clean and determine the short code
    final_short_code = org_input.short_code or utils.generate_short_code(org_input.name)
    
    #ensure the short code is completely unique in the system
    existing_short_code = db.query(models.Organization).filter(
        models.Organization.short_code == final_short_code
    ).first()
    if existing_short_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The short code '{final_short_code}' is already taken. Please provide a different one."
        )

    #create the Organization first
    new_org = models.Organization(
        name=org_input.name,
        short_code=final_short_code,
        slug=org_input.name.lower().replace(" ", "-")
    )
    db.add(new_org)
    db.flush()  #flushes to DB to generate 'new_org.id' without committing yet

    #create the Admin User linked to the organization
    new_admin = models.User(
        full_name=org_input.admin_full_name,
        email=org_input.admin_email,
        password_hash=security.get_password_hash(org_input.password),
        role=models.UserRole.ADMIN,
        org_id=new_org.id,
        is_active=False  #must verify via email before logging in
    )
    db.add(new_admin)
    db.commit()  

    #generate token and send onboarding verification email
    token = security.create_verification_token(new_admin.email)
    utils.send_verification_email(new_admin.email, token)

    return {"message": "Registration successful! Please verify your email via the link sent."}



# GET CURRENT SCHOOL INFO (ADMIN ONLY)
@router.get("/my-school", response_model=schemas.OrgResponse)
def get_my_school(
    current_admin: models.User = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    #returns the organization linked to the active Admin account
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

    # If they updated the name, generate a new URL-friendly slug
    if "name" in update_data:
        org.slug = update_data["name"].lower().replace(" ", "-")

    for key, value in update_data.items():
        setattr(org, key, value)

    db.commit()
    db.refresh(org)
    return org