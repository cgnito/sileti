from uuid import UUID
from typing import List
from datetime import datetime
import csv
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import security
import schemas
from database import get_db

router = APIRouter(prefix="/students", tags=["Student Management"])

# HELPER LOGIC FUNCTIONS
def get_next_serial(db: Session, org_id: UUID, year: int) -> int:
    """Finds the current highest serial for this school/year."""
    max_val = db.query(func.max(models.Student.serial_number)).filter(
        models.Student.org_id == org_id,
        models.Student.admission_year == year
    ).scalar()
    return (max_val or 0) + 1

def format_ko_id(short_code: str, year: int, serial: int) -> str:
    """Formats the ID into the human-readable string: KWA/2026/0001"""
    return f"{short_code}/{year}/{serial:04d}"



# CREATE A SINGLE STUDENT (Access: Admin, Bursar)
@router.post("/", response_model=schemas.StudentResponse, status_code=status.HTTP_201_CREATED)
def create_single_student(
    student_in: schemas.StudentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    # Security: Check if class belongs to this school
    school_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.id == student_in.class_id,
        models.SchoolClass.org_id == current_user.org_id
    ).first()
    
    if not school_class:
        raise HTTPException(status_code=400, detail="That class does not exist in your school.")

    # Generate the ID
    year = datetime.now().year
    short_code = current_user.organization.short_code
    next_serial = get_next_serial(db, current_user.org_id, year)
    readable_id = format_ko_id(short_code, year, next_serial)

    # Save
    new_student = models.Student(
        org_id=current_user.org_id,
        class_id=student_in.class_id,
        ko_id=readable_id,
        serial_number=next_serial,
        admission_year=year,
        first_name=student_in.first_name,
        last_name=student_in.last_name,
        date_of_birth=student_in.date_of_birth
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return new_student

# BULK UPLOAD STUDENTS (Access: Admin, Bursar)
@router.post("/bulk-upload/{class_id}")
def bulk_upload_students(
    class_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    # Setup & Validation
    school_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.id == class_id,
        models.SchoolClass.org_id == current_user.org_id
    ).first()
    if not school_class:
        raise HTTPException(status_code=400, detail="Invalid class")

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    # Prepare the ID Sequence
    year = datetime.now().year
    short_code = current_user.organization.short_code
    
    current_serial = get_next_serial(db, current_user.org_id, year) #fetch starting point for serial number sequence based on existing students in the same year and org

    # Process File
    content = file.file.read().decode('utf-8')
    reader = csv.DictReader(StringIO(content))
    
    students_to_add = []
    
    for row in reader:
        if not row.get('first_name') or not row.get('last_name'):
            continue
        
        # Generate the ID for this specific row
        readable_id = format_ko_id(short_code, year, current_serial)
        
        new_student = models.Student(
            org_id=current_user.org_id,
            class_id=class_id,
            ko_id=readable_id,
            serial_number=current_serial, # Use the counter
            admission_year=year,
            first_name=row['first_name'],
            last_name=row['last_name'],
            date_of_birth=datetime.strptime(row['dob'], '%Y-%m-%d').date() if row.get('dob') else None
        )
        students_to_add.append(new_student)
        
        # increment the serial for the next student
        current_serial += 1

    # Save everything in one go
    db.add_all(students_to_add)
    db.commit()

    return {"message": f"Successfully admitted {len(students_to_add)} students to {school_class.name}"}


# BULK PROMOTION (Access: Admin Only)
@router.post("/bulk-promotion")
def bulk_promote_students(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(security.allow_admin_only)
):
    graduated = 0
    promoted = 0

    # db.begin() - if one update fails, NO students are moved
    with db.begin():
        # order by level DESCENDING to avoid moving the same student twice
        school_classes = db.query(models.SchoolClass).filter(
            models.SchoolClass.org_id == current_admin.org_id
        ).order_by(models.SchoolClass.level.desc()).all()

        if not school_classes:
            raise HTTPException(status_code=400, detail="No classes found for this school")

        max_level = school_classes[0].level
        
        # Pre-group classes by level for target matching
        classes_by_level = {}
        for sc in school_classes:
            classes_by_level.setdefault(sc.level, []).append(sc)

        for school_class in school_classes:
            # Target students in THIS class who are ACTIVE
            active_students = db.query(models.Student).filter(
                models.Student.org_id == current_admin.org_id,
                models.Student.class_id == school_class.id,
                models.Student.status == models.StudentStatus.ACTIVE
            ).all()

            if not active_students:
                continue

            # Case: Graduation (Highest Level)
            if school_class.level == max_level:
                for student in active_students:
                    student.status = models.StudentStatus.GRADUATED
                    student.class_id = None
                    graduated += 1
                continue

            # Case: Promotion (Move to level + 1)
            next_level = school_class.level + 1
            target_options = classes_by_level.get(next_level)

            if not target_options:
                continue

            current_suffix = school_class.name.split()[-1].lower()
            target_class = target_options[0]
            
            for t in target_options:
                if current_suffix in t.name.lower():
                    target_class = t
                    break

            for student in active_students:
                student.class_id = target_class.id
                promoted += 1

    return {
        "graduated": graduated,
        "promoted": promoted,
        "message": "School session rolled over successfully. Entry-level classes are now empty for new intake."
    }

# LIST ALL STUDENTS (Access: All Users)
@router.get("/", response_model=List[schemas.StudentResponse])
def list_all_students(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    return db.query(models.Student).filter(models.Student.org_id == current_user.org_id).all()


# LIST STUDENTS BY CLASS (Access: All Users)
@router.get("/class/{class_id}", response_model=List[schemas.StudentResponse])
def list_students_by_class(
    class_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    students = db.query(models.Student).filter(
        models.Student.class_id == class_id,
        models.Student.org_id == current_user.org_id
    ).all()
    return students


# GET SINGLE STUDENT (Access: All Users)
@router.get("/{student_id}", response_model=schemas.StudentResponse)
def get_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    student = db.query(models.Student).filter(
        models.Student.id == student_id,
        models.Student.org_id == current_user.org_id
    ).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return student


# UPDATE STUDENT (Access: Admin, Bursar)
@router.patch("/{student_id}", response_model=schemas.StudentResponse)
def update_student(
    student_id: UUID,
    student_update: schemas.StudentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    student = db.query(models.Student).filter(
        models.Student.id == student_id,
        models.Student.org_id == current_user.org_id
    ).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    update_data = student_update.model_dump(exclude_unset=True)
    
    # If class_id is being updated, verify the new class exists in the org
    if "class_id" in update_data:
        new_class = db.query(models.SchoolClass).filter(
            models.SchoolClass.id == update_data["class_id"],
            models.SchoolClass.org_id == current_user.org_id
        ).first()
        if not new_class:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid class")

    for key, value in update_data.items():
        setattr(student, key, value)

    db.commit()
    db.refresh(student)
    return student


# DELETE STUDENT (Access: Admin Only)
@router.delete("/{student_id}")
def delete_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(security.allow_admin_only)
):
    student = db.query(models.Student).filter(
        models.Student.id == student_id,
        models.Student.org_id == current_admin.org_id
    ).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    db.delete(student)
    db.commit()
    return {"detail": "Student deleted successfully"}
