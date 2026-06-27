import uuid
from sqlalchemy import Enum, Column, String, DateTime, JSON, ForeignKey, Integer, Date, Boolean, Table, Numeric
import enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    
    #short_code will be used for human-readable IDs (e.g., 'KWA')
    short_code = Column(String(10), unique=True, nullable=False)
    
    #slug for URL-friendly names (e.g., 'greenwood-academy')
    slug = Column(String(100), unique=True, nullable=False)
    
    #JSONB field for flexible school-specific settings
    settings = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    #relationship
    users = relationship("User", back_populates="organization")



class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    BURSAR = "bursar"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    
    role = Column(Enum(UserRole), default=UserRole.BURSAR)
    is_active = Column(Boolean, default=False)

    #relationship back to Organization
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
    level = Column(Integer, nullable=False)    # e.g., 7 (for sorting and promotion logic)

    #relationship
    students = relationship("Student", back_populates="school_class")

#linker table for students and parents (since it is a many-to-many)
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
    
    # The human-readable ID: e.g., "CHS/2026/0001"
    silete_id = Column(String(30), unique=True, nullable=False, index=True)
    
    # helpers columns for id generation
    serial_number = Column(Integer, nullable=False) # e.g., 1
    admission_year = Column(Integer, nullable=False) # e.g., 2026
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=True)

    # Optional parent email storage (falls back to an auto-generated variant if empty)
    parent_email = Column(String(255), nullable=True)
    
    status = Column(Enum(StudentStatus), default=StudentStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    school_class = relationship("SchoolClass", back_populates="students")
    parents = relationship("Parent", secondary=student_parents, back_populates="students")


class Parent(Base):
    __tablename__ = "parents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    
    #unique so a phone number can't be registered twice by mistake
    primary_phone = Column(String(20), nullable=False, unique=True, index=True)
    is_verified = Column(Boolean, default=False)

    #relationship back to Students
    students = relationship("Student", secondary=student_parents, back_populates="parents")


class FeeTemplate(Base):
    __tablename__ = "fee_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    
    name = Column(String(255), nullable=False)  # e.g., "First Term - JSS1"
    description = Column(String, nullable=True) # Optional details
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    #relationship
    #when a template us deleted, we want to delete its line items (cascade)
    line_items = relationship("FeeLineItem", back_populates="template", cascade="all, delete-orphan")


class FeeLineItem(Base):
    __tablename__ = "fee_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("fee_templates.id"), nullable=False)
    
    name = Column(String(255), nullable=False)  # e.g., "Tuition"
    amount = Column(Numeric(12, 2), nullable=False) # Precise financial decimal
    is_compulsory = Column(Boolean, default=True, nullable=False)

    #relationship
    template = relationship("FeeTemplate", back_populates="line_items")


class InvoiceStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"
    VOIDED = "voided"

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    
    #to filter exports by Term/Session easily
    #the session and term how do we get that since we do not put it in our fee template schemas
    session = Column(String(20), nullable=False) # e.g., "2025/2026" 
    term = Column(String(20), nullable=False)    # e.g., "First Term"
    
    total_amount = Column(Numeric(12, 2), nullable=False)
    paid_amount = Column(Numeric(12, 2), default=0.00)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.UNPAID)
    
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    #relationship
    student = relationship("Student")
    #this links to the snapshot of items
    items = relationship("InvoiceDetail", back_populates="invoice", cascade="all, delete-orphan")
    # Bidirectional tracking relationship for the payment ledger log array
    transactions = relationship("Transaction", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceDetail(Base):
    #the snapshot: stores items at the price they were when billed
    __tablename__ = "invoice_details"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    
    name = Column(String(255), nullable=False) # e.g., "Tuition"
    amount = Column(Numeric(12, 2), nullable=False)

    invoice = relationship("Invoice", back_populates="items")


class Transaction(Base):
    #the ledger: immutable record of every successful payment
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    
    amount = Column(Numeric(12, 2), nullable=False)
    #the reference from Paystack/Flutterwave to prevent double-crediting
    reference = Column(String(100), unique=True, nullable=False)
    
    #method of payment(transfer, card, ussd)
    channel = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="transactions")