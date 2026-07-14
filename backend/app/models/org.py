import uuid
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_name = Column(String(255), nullable=False)
    short_code = Column(String(10), unique=True, nullable=False)
    school_email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    has_setup_bank = Column(Boolean, default=False, nullable=False)
    is_onboarding_completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    bank_settlement = relationship(
        "BankSettlement", back_populates="organization", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def name(self):
        return self.school_name

    @name.setter
    def name(self, value):
        self.school_name = value


class BankSettlement(Base):
    __tablename__ = "bank_settlements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True)
    bank_name = Column(String(100), nullable=False)
    bank_code = Column(String(20), nullable=True)
    account_number = Column(String(20), nullable=False)
    account_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", back_populates="bank_settlement")
