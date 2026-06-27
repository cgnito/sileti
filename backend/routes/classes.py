from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import security
from database import get_db
from schemas.classes import ClassCreate, ClassResponse, ClassUpdate

router = APIRouter(prefix="/classes", tags=["Class Management"])

# CREATE A NEW CLASS (Access: Admin, Bursar)
@router.post("/", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    class_in: ClassCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    # Concurrency Guard: Explicit read verification with a hard block against existing rows.
    # Because your Pydantic schema already strips and title-cases class_in.name,
    # this check perfectly aligns with your clean database state.
    existing_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.org_id == current_user.org_id,
        models.SchoolClass.name == class_in.name
    ).first()
    if existing_class:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A class with this name already exists in your school."
        )

    new_class = models.SchoolClass(
        org_id=current_user.org_id,
        name=class_in.name,
        level=class_in.level
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return new_class




# GET ALL CLASSES (Access: Admin, Bursar)
@router.get("/", response_model=List[ClassResponse])
def get_classes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    return db.query(models.SchoolClass).filter(
        models.SchoolClass.org_id == current_user.org_id
    ).all()



# UPDATE A CLASS (Access: Admin, Bursar)
@router.patch("/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: UUID,
    class_update: ClassUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    school_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.id == class_id,
        models.SchoolClass.org_id == current_user.org_id
    ).first()
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    update_data = class_update.model_dump(exclude_unset=True)
    
    # If name is being updated, validate against existing naming metrics to prevent conflicts
    if "name" in update_data and update_data["name"]:
        duplicate = db.query(models.SchoolClass).filter(
            models.SchoolClass.org_id == current_user.org_id,
            models.SchoolClass.name == update_data["name"],
            models.SchoolClass.id != school_class.id
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A class with this name already exists in your school."
            )

    for key, value in update_data.items():
        setattr(school_class, key, value)

    db.commit()
    db.refresh(school_class)
    return school_class




# DELETE A CLASS (Access: Admin)
@router.delete("/{class_id}")
def delete_class(
    class_id: UUID,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(security.allow_admin_only)
):
    school_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.id == class_id,
        models.SchoolClass.org_id == current_admin.org_id
    ).first()
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    student_count = db.query(models.Student).filter(
        models.Student.class_id == class_id
    ).count()
    if student_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a class that contains active student records. Reassign students first."
        )

    db.delete(school_class)
    db.commit()
    return {"message": "Class deleted successfully"}