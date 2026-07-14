from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app import models, security
import schemas
from app.database import get_db

router = APIRouter(prefix="/billing/templates", tags=["Fee Templates"])


# create a master fee template package with sub-line items
@router.post("/", response_model=schemas.FeeTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_fee_template(
    template_in: schemas.FeeTemplateCreate,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.allow_admin_only)
):
    # check for duplication across name variants within the organization shell context
    existing_template = db.query(models.FeeTemplate).filter(
        models.FeeTemplate.org_id == current_user.org_id,
        models.FeeTemplate.name == template_in.name
    ).first()
    
    if existing_template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="a fee template with this profile package name already exists."
        )

    # logical fix: initialize template base instance without tying to rigid sessions/terms
    new_template = models.FeeTemplate(
        org_id=current_user.org_id,
        name=template_in.name,
        description=template_in.description
    )
    
    db.add(new_template)
    db.flush()  # flushes token records to secure generated template master identification id

    # loop and assign children array collections securely
    for item in template_in.line_items:
        line_item = models.FeeLineItem(
            template_id=new_template.id,
            name=item.name,
            amount=item.amount,
            is_compulsory=item.is_compulsory
        )
        db.add(line_item)

    db.commit()
    db.refresh(new_template)
    return new_template


# list all fee templates owned by the school organization
@router.get("/", response_model=List[schemas.FeeTemplateResponse])
def list_fee_templates(
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    templates = db.query(models.FeeTemplate).filter(
        models.FeeTemplate.org_id == current_user.org_id
    ).all()
    return templates


# get single comprehensive template structure map
@router.get("/{template_id}", response_model=schemas.FeeTemplateResponse)
def get_fee_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    template = db.query(models.FeeTemplate).filter(
        models.FeeTemplate.id == template_id,
        models.FeeTemplate.org_id == current_user.org_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="requested fee template package profile not found."
        )
    return template


# update a fee template and optionally replace its line items
@router.patch("/{template_id}", response_model=schemas.FeeTemplateResponse)
def update_fee_template(
    template_id: UUID,
    template_in: schemas.FeeTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.allow_admin_only)
):
    template = db.query(models.FeeTemplate).filter(
        models.FeeTemplate.id == template_id,
        models.FeeTemplate.org_id == current_user.org_id
    ).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="requested fee template package profile not found."
        )

    update_data = template_in.model_dump(exclude_unset=True)

    if "name" in update_data:
        duplicate_template = db.query(models.FeeTemplate).filter(
            models.FeeTemplate.org_id == current_user.org_id,
            models.FeeTemplate.name == update_data["name"],
            models.FeeTemplate.id != template.id
        ).first()
        if duplicate_template:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="a fee template with this profile package name already exists."
            )
        template.name = update_data["name"]

    if "description" in update_data:
        template.description = update_data["description"]

    if "line_items" in update_data:
        template.line_items.clear()
        for item in template_in.line_items or []:
            template.line_items.append(models.FeeLineItem(
                name=item.name,
                amount=item.amount,
                is_compulsory=item.is_compulsory
            ))

    db.commit()
    db.refresh(template)
    return template


# completely nuke a master configuration catalog template profile
@router.delete("/{template_id}")
def delete_fee_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.allow_admin_only)
):
    template = db.query(models.FeeTemplate).filter(
        models.FeeTemplate.id == template_id,
        models.FeeTemplate.org_id == current_user.org_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="requested fee template package profile not found."
        )

    db.delete(template)
    db.commit()
    return {"message": "fee template profile package and all its dependent line items removed successfully."}
