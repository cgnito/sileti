from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, security
from app.database import get_db
from schemas.classes import ClassCreate, ClassResponse, ClassUpdate

router = APIRouter(prefix="/classes", tags=["Class Management"])

# create a new class (access: admin, staff)
@router.post("/", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    class_in: ClassCreate,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    # check if a class with the same name already exists in this organization
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


# get all classes (access: admin, staff)
@router.get("/", response_model=List[ClassResponse])
def get_classes(
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    return db.query(models.SchoolClass).filter(
        models.SchoolClass.org_id == current_user.org_id
    ).all()


# update a class (access: admin, staff)
@router.patch("/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: UUID,
    class_update: ClassUpdate,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    school_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.id == class_id,
        models.SchoolClass.org_id == current_user.org_id
    ).first()
    if not school_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    update_data = class_update.model_dump(exclude_unset=True)
    
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


# delete a class (access: admin only)
@router.delete("/{class_id}")
def delete_class(
    class_id: UUID,
    db: Session = Depends(get_db),
    current_admin: security.AuthContext = Depends(security.allow_admin_only)
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