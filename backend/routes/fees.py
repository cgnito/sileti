from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/billing/templates", tags=["Fee Configurations"])

# CREATE FEE TEMPLATE WITH LINE ITEMS (ADMIN/BURSAR ONLY)
@router.post("/", response_model=schemas.FeeTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_fee_template(
    template_in: schemas.FeeTemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    """
    Creates a master fee structure package alongside its distinct cost components.
    """
    # Concurrency Guard: Prevent double-click creation of identical templates within the same school
    existing_template = db.query(models.FeeTemplate).filter(
        models.FeeTemplate.org_id == current_user.org_id,
        models.FeeTemplate.name == template_in.name,
        models.FeeTemplate.deleted_at == None
    ).first()

    if existing_template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A fee template named '{template_in.name}' already exists and is active."
        )

    template = models.FeeTemplate(
        name=template_in.name,
        description=template_in.description,
        org_id=current_user.org_id
    )
    db.add(template)
    db.flush() 

    line_items = [
        models.FeeLineItem(
            name=item.name,
            amount=item.amount,
            is_compulsory=item.is_compulsory,
            template_id=template.id
        )
        for item in template_in.line_items
    ]
    db.add_all(line_items)
    db.commit()
    db.refresh(template)
    return template



# GET ALL ACTIVE FEE TEMPLATES FOR AN ORGANIZATION
@router.get("/", response_model=list[schemas.FeeTemplateResponse])
def get_fee_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    """
    Retrieves all non-deleted fee templates belonging exclusively to the authenticated user's organization.
    """
    return db.query(models.FeeTemplate).options(
        selectinload(models.FeeTemplate.line_items)
    ).filter(
        models.FeeTemplate.org_id == current_user.org_id,
        models.FeeTemplate.deleted_at == None
    ).all()



# GET SINGLE FEE TEMPLATE DETAILS BY ID
@router.get("/{template_id}", response_model=schemas.FeeTemplateResponse)
def get_fee_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    """
    Retrieves the complete breakdown structure of a specific fee template.
    """
    # Security Patch: Added multi-tenant isolation guard via current_user.org_id
    template = db.query(models.FeeTemplate).options(
        selectinload(models.FeeTemplate.line_items)
    ).filter(
        models.FeeTemplate.id == template_id,
        models.FeeTemplate.org_id == current_user.org_id,
        models.FeeTemplate.deleted_at == None
    ).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee template not found or access denied."
        )
    return template



# DELETE FEE TEMPLATE (ADMIN/BURSAR ONLY) - SOFT DELETE WITH TIMESTAMP
@router.delete("/{template_id}")
def delete_fee_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.allow_admin_only)
):
    """
    Soft-deletes a master fee configuration.
    Preserves old historic invoice definitions by setting a deletion timestamp instead of dropping rows.
    """
    query = db.query(models.FeeTemplate).filter(
        models.FeeTemplate.id == template_id,
        models.FeeTemplate.org_id == current_user.org_id,
        models.FeeTemplate.deleted_at == None
    )

    template = query.first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee template not found"
        )

    # Perform soft delete by tracking deletion time context
    template.deleted_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Fee template deleted successfully"}