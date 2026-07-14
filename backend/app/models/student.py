import uuid
import enum
from sqlalchemy import Enum, Column, String, DateTime, Integer, Date, Boolean, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .base import Base


class StudentStatus(str, enum.Enum):
    ACTIVE = "active"
    GRADUATED = "graduated"
    WITHDRAWN = "withdrawn"


class SchoolClass(Base):
    __tablename__ = "classes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(50), nullable=False)
    level = Column(Integer, nullable=False)

    students = relationship("Student", back_populates="school_class")


# Many-to-many linker between students and parents
student_parents = Table(
    "student_parents",
    Base.metadata,
    Column("student_id", UUID(as_uuid=True), ForeignKey("students.id"), primary_key=True),
    Column("parent_id", UUID(as_uuid=True), ForeignKey("parents.id"), primary_key=True),
)


class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=True)
    silete_id = Column(String(30), unique=True, nullable=False, index=True)
    serial_number = Column(Integer, nullable=False)
    admission_year = Column(Integer, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    parent_email = Column(String(255), nullable=True)
    status = Column(Enum(StudentStatus), default=StudentStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    school_class = relationship("SchoolClass", back_populates="students")
    parents = relationship("Parent", secondary=student_parents, back_populates="students")


class Parent(Base):
    __tablename__ = "parents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    primary_phone = Column(String(20), nullable=False, unique=True, index=True)
    is_verified = Column(Boolean, default=False)

    students = relationship("Student", secondary=student_parents, back_populates="parents")
