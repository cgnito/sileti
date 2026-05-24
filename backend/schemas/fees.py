from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

import utils

# FEE LINE ITEM SCHEMAS

class FeeLineItemBase(BaseModel):
    """Shared fields for a single line item cost within a billing template."""
    name: str = Field(..., min_length=2, max_length=100, examples=["Tuition Fee"])
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2, examples=[150000.00])
    
    is_compulsory: bool = Field(True, description="Whether this fee applies to all students automatically")

    @field_validator('name')
    @classmethod
    def clean_item_name(cls, v: str) -> str:
        return utils.sanitize_text(v)


class FeeLineItemCreate(FeeLineItemBase):
    """Schema used to validate line items when nesting them inside a template creation request."""
    pass


class FeeLineItemResponse(FeeLineItemBase):
    """Schema formatting the database records of line items sent back to the client UI."""
    id: UUID

    class Config:
        from_attributes = True


class OptionalAllocation(BaseModel):
    student_id: UUID
    selected_line_item_ids: list[UUID]


class InvoiceGenerationRequest(BaseModel):
    class_id: UUID
    template_id: UUID
    session: str = Field(..., min_length=4, max_length=20, examples=["2025/2026"])
    term: str = Field(..., min_length=4, max_length=30, examples=["First Term"])
    due_date: Optional[date] = None
    optional_allocations: list[OptionalAllocation] = Field(default_factory=list)


# FEE TEMPLATE SCHEMAS

class FeeTemplateBase(BaseModel):
    """Shared fields for structural fee groupings."""
    name: str = Field(..., min_length=3, max_length=150, examples=["First Term - JSS1 Standard Package"])
    description: Optional[str] = Field(None, max_length=500, examples=["Includes standard tuition and uniforms"])

    @field_validator('name')
    @classmethod
    def clean_template_name(cls, v: str) -> str:
        """Strip malicious inputs or unnecessary spaces from the master package name."""
        return utils.sanitize_text(v)

    @field_validator('description')
    @classmethod
    def clean_description(cls, v: Optional[str]) -> Optional[str]:
        """Clean the description text field if it is provided."""
        if v:
            return utils.sanitize_text(v)
        return v


class FeeTemplateCreate(FeeTemplateBase):
    """Schema handling validation for incoming payload when saving a brand new template."""
    line_items: list[FeeLineItemCreate] = Field(..., min_length=1)


class FeeTemplateResponse(FeeTemplateBase):
    """Schema formatting database records of full fee packages sent back to the client UI."""
    id: UUID
    org_id: UUID
    line_items: list[FeeLineItemResponse]
    created_at: datetime

    class Config:
        from_attributes = True


# INVOICE RUNTIME SCHEMAS

class InvoiceDetailResponse(BaseModel):
    """Formats the specific snapshotted line-item records attached to an invoice."""
    id: UUID
    name: str
    amount: Decimal

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    """Formats the master invoice statement for client dashboards and parent bills."""
    id: UUID
    student_id: UUID
    session: str
    term: str
    total_amount: Decimal
    paid_amount: Decimal
    status: str  # e.g., "unpaid", "partially_paid", "paid"
    due_date: Optional[date] = None
    items: list[InvoiceDetailResponse]  # Returns the full sub-item breakdown array

    class Config:
        from_attributes = True


class AddOptionalItemRequest(BaseModel):
    """Validates input when an administrator appends a missed optional fee to a student's profile."""
    fee_line_item_id: UUID  # The ID of the item from the catalog template