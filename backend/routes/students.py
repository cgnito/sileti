from uuid import UUID
from typing import List, Optional
from datetime import datetime
import csv
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

from app import models, security
from services import utils
import schemas
from app.database import get_db

router = APIRouter(prefix="/students", tags=["Student Management"])
_UNSET = object()


# helper functions for serial identification numbers
def get_next_serial(db: Session, org_id: UUID, year: int) -> int:
    max_val = db.query(func.max(models.Student.serial_number)).filter(
        models.Student.org_id == org_id,
        models.Student.admission_year == year
    ).scalar()
    return (max_val or 0) + 1


def format_silete_id(short_code: str, year: int, serial: int) -> str:
    return f"{short_code}/{year}/{serial:04d}"


def _sync_primary_parent(
    db: Session,
    student: models.Student,
    org_id: UUID,
    parent_phone: Optional[str] = None,
    parent_email: Optional[str] | object = _UNSET,
) -> None:
    if parent_email is not _UNSET:
        student.parent_email = utils.sanitize_email(parent_email) if parent_email else None

    if not parent_phone:
        if not student.parents:
            student.parents = []
        return

    normalized_phone = utils.normalize_phone_number(parent_phone)
    if not normalized_phone:
        if not student.parents:
            student.parents = []
        return

    parent = db.query(models.Parent).filter(
        models.Parent.primary_phone == normalized_phone
    ).first()

    if not parent:
        parent = models.Parent(
            org_id=org_id,
            primary_phone=normalized_phone,
            is_verified=False,
        )
        db.add(parent)
        db.flush()

    student.parents = [parent]


def _decorate_student_contact(student: models.Student) -> models.Student:
    primary_parent = student.parents[0] if getattr(student, "parents", None) else None
    student.parent_phone = primary_parent.primary_phone if primary_parent else None
    if not getattr(student, "parent_email", None):
        student.parent_email = None
    return student


# create a single student (access: admin, staff)
@router.post("/", response_model=schemas.StudentResponse, status_code=status.HTTP_201_CREATED)
def create_single_student(
    student_in: schemas.StudentCreate,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    school_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.id == student_in.class_id,
        models.SchoolClass.org_id == current_user.org_id
    ).first()
    if not school_class:
        raise HTTPException(status_code=400, detail="That class does not exist in your school.")

    year = datetime.now().year
    short_code = current_user.organization.short_code
    next_serial = get_next_serial(db, current_user.org_id, year)
    readable_id = format_silete_id(short_code, year, next_serial)

    new_student = models.Student(
        org_id=current_user.org_id,
        class_id=student_in.class_id,
        silete_id=readable_id,
        serial_number=next_serial,
        admission_year=year,
        first_name=student_in.first_name,
        last_name=student_in.last_name,
        date_of_birth=student_in.date_of_birth,
        parent_email=student_in.parent_email,
    )
    db.add(new_student)
    db.flush()
    _sync_primary_parent(db, new_student, current_user.org_id, student_in.parent_phone, student_in.parent_email)
    db.commit()
    db.refresh(new_student)
    new_student = db.query(models.Student).options(selectinload(models.Student.parents)).filter(
        models.Student.id == new_student.id,
        models.Student.org_id == current_user.org_id,
    ).first()
    return _decorate_student_contact(new_student)


# bulk upload students from csv file (access: admin, staff)
@router.post("/bulk-upload/{class_id}")
def bulk_upload_students(
    class_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    school_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.id == class_id,
        models.SchoolClass.org_id == current_user.org_id
    ).first()
    if not school_class:
        raise HTTPException(status_code=400, detail="Invalid class")

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    year = datetime.now().year
    short_code = current_user.organization.short_code
    current_serial = get_next_serial(db, current_user.org_id, year)

    content = file.file.read().decode('utf-8')
    reader = csv.DictReader(StringIO(content))
    students_to_add = []

    try:
        for row in reader:
            first_name = (row.get('first_name') or '').strip()
            last_name = (row.get('last_name') or '').strip()
            parent_phone = (row.get('parent_phone') or '').strip() or None
            parent_email = (row.get('parent_email') or '').strip() or None
            dob_value = (row.get('dob') or '').strip()
            date_of_birth = None

            if not first_name or not last_name:
                continue

            if dob_value:
                try:
                    date_of_birth = datetime.strptime(dob_value, '%Y-%m-%d').date()
                except ValueError:
                    date_of_birth = None

            readable_id = format_silete_id(short_code, year, current_serial)
            new_student = models.Student(
                org_id=current_user.org_id,
                class_id=class_id,
                silete_id=readable_id,
                serial_number=current_serial,
                admission_year=year,
                first_name=first_name,
                last_name=last_name,
                date_of_birth=date_of_birth,
                parent_email=utils.sanitize_email(parent_email) if parent_email else None,
            )
            db.add(new_student)
            db.flush()
            _sync_primary_parent(db, new_student, current_user.org_id, parent_phone, parent_email)
            students_to_add.append(new_student)
            current_serial += 1

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process bulk student upload: {str(exc)}"
        ) from exc

    return {"message": f"Successfully admitted {len(students_to_add)} students to {school_class.name}"}


# bulk promotion and school session rollover (access: admin only)
@router.post("/bulk-promotion")
def bulk_promote_students(
    db: Session = Depends(get_db),
    current_admin: security.AuthContext = Depends(security.allow_admin_only)
):
    graduated = 0
    promoted = 0

    try:
        # order by level descending to avoid moving the same student twice
        school_classes = db.query(models.SchoolClass).filter(
            models.SchoolClass.org_id == current_admin.org_id
        ).order_by(models.SchoolClass.level.desc()).all()

        if not school_classes:
            raise HTTPException(status_code=400, detail="no classes found for this school")

        max_level = school_classes[0].level
        
        # pre-group classes by level for target matching
        classes_by_level = {}
        for sc in school_classes:
            classes_by_level.setdefault(sc.level, []).append(sc)

        for school_class in school_classes:
            # target students in this class who are active
            active_students = db.query(models.Student).filter(
                models.Student.org_id == current_admin.org_id,
                models.Student.class_id == school_class.id,
                models.Student.status == models.StudentStatus.ACTIVE
            ).all()

            if not active_students:
                continue

            # case: graduation (highest level)
            if school_class.level == max_level:
                for student in active_students:
                    student.status = models.StudentStatus.GRADUATED
                    student.class_id = None
                    graduated += 1
                continue

            # case: promotion (move to level + 1)
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

        # commit all promotions together atomically
        db.commit()

    except Exception as e:
        # roll back the database transaction if any single modification fails
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"failed to complete bulk promotion sequence: {str(e)}"
        )

    return {
        "graduated": graduated,
        "promoted": promoted,
        "message": "school session rolled over successfully. entry-level classes are now empty for new intake."
    }


# list all students or filter by class (access: admin, staff)
@router.get("/", response_model=List[schemas.StudentResponse])
def list_all_students(
    class_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    query = db.query(models.Student).options(selectinload(models.Student.parents)).filter(models.Student.org_id == current_user.org_id)
    if class_id:
        query = query.filter(models.Student.class_id == class_id)
    return [_decorate_student_contact(student) for student in query.all()]


# get single student profile (access: admin, staff)
@router.get("/{student_id}", response_model=schemas.StudentResponse)
def get_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    student = db.query(models.Student).filter(
        models.Student.id == student_id,
        models.Student.org_id == current_user.org_id
    ).options(selectinload(models.Student.parents)).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return _decorate_student_contact(student)


# update student records (access: admin, staff)
@router.patch("/{student_id}", response_model=schemas.StudentResponse)
def update_student(
    student_id: UUID,
    student_update: schemas.StudentUpdate,
    db: Session = Depends(get_db),
    current_user: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"]))
):
    student = db.query(models.Student).filter(
        models.Student.id == student_id,
        models.Student.org_id == current_user.org_id
    ).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    update_data = student_update.model_dump(exclude_unset=True)
    
    if "class_id" in update_data:
        new_class = db.query(models.SchoolClass).filter(
            models.SchoolClass.id == update_data["class_id"],
            models.SchoolClass.org_id == current_user.org_id
        ).first()
        if not new_class:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid class")

    parent_phone = update_data.pop("parent_phone", None)
    parent_email_present = "parent_email" in update_data
    parent_email = update_data.pop("parent_email", None)
    for key, value in update_data.items():
        setattr(student, key, value)

    if parent_phone is not None or parent_email_present:
        _sync_primary_parent(
            db,
            student,
            current_user.org_id,
            parent_phone,
            parent_email if parent_email_present else _UNSET,
        )

    db.commit()
    db.refresh(student)
    student = db.query(models.Student).options(selectinload(models.Student.parents)).filter(
        models.Student.id == student_id,
        models.Student.org_id == current_user.org_id,
    ).first()
    return _decorate_student_contact(student)


# delete student profile permanently (access: admin only)
@router.delete("/{student_id}")
def delete_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_admin: security.AuthContext = Depends(security.allow_admin_only)
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
