import uuid
import enum
from sqlalchemy import Enum, Column, String, DateTime, JSON, ForeignKey, Integer, Date, Boolean, Table, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_name = Column(String(255), nullable=False)
    
    # short_code will be used for human-readable IDs (e.g., 'KWA')
    short_code = Column(String(10), unique=True, nullable=False)
    
    # unique login email for the school admin account
    school_email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    
    # slug for URL-friendly names (e.g., 'greenwood-academy')
    slug = Column(String(100), unique=True, nullable=False)
    
    # tracked flag for email verification status
    is_verified = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")

    @property
    def name(self):
        return self.school_name

    @name.setter
    def name(self, value):
        self.school_name = value


class UserRole(str, enum.Enum):
    STAFF = "staff"
    BURSAR = "bursar"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)  # Nullable initially for invitation flows
    
    role = Column(Enum(UserRole), default=UserRole.STAFF)
    is_active = Column(Boolean, default=False)

    # relationships
    organization = relationship("Organization", back_populates="users")


class StudentStatus(str, enum.Enum):
    ACTIVE = "active"
    GRADUATED = "graduated"
    WITHDRAWN = "withdrawn"


class SchoolClass(Base):
    __tablename__ = "classes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(50), nullable=False)  # e.g., "JSS 1 Gold"
    level = Column(Integer, nullable=False)    # numeric grade level for sorting

    # relationships
    students = relationship("Student", back_populates="school_class")


# linker table for many-to-many relationship
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

    # relationships
    school_class = relationship("SchoolClass", back_populates="students")
    parents = relationship("Parent", secondary=student_parents, back_populates="students")


class Parent(Base):
    __tablename__ = "parents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    primary_phone = Column(String(20), nullable=False, unique=True, index=True)
    is_verified = Column(Boolean, default=False)

    # relationships
    students = relationship("Student", secondary=student_parents, back_populates="parents")


class InvoiceStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partially_paid"
    PAID = "paid"
    VOIDED = "voided"


class FeeTemplate(Base):
    __tablename__ = "fee_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "JSS 1 First Term Template"
    description = Column(String, nullable=True) # Optional details
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # relationships
    line_items = relationship("FeeLineItem", back_populates="template", cascade="all, delete-orphan")


class FeeLineItem(Base):
    __tablename__ = "fee_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("fee_templates.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "Tuition Fee"
    amount = Column(Numeric(12, 2), nullable=False)
    is_compulsory = Column(Boolean, default=True)

    # relationships
    template = relationship("FeeTemplate", back_populates="line_items")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    
    session = Column(String(20), nullable=False)  # e.g., "2025/2026"
    term = Column(String(20), nullable=False)     # e.g., "First Term"
    
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.UNPAID)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # relationships
    student = relationship("Student")
    items = relationship("InvoiceDetail", back_populates="invoice", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceDetail(Base):
    __tablename__ = "invoice_details"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    # relationships
    invoice = relationship("Invoice", back_populates="items")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    
    amount = Column(Numeric(12, 2), nullable=False)
    reference = Column(String(100), unique=True, nullable=False)
    status = Column(String(50), nullable=False)  # e.g., "successful"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # relationships
    invoice = relationship("Invoice", back_populates="transactions")