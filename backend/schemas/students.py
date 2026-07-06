from pydantic import BaseModel, Field, field_validator
from datetime import date
from typing import Optional
from uuid import UUID
import utils

class StudentBase(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    date_of_birth: Optional[date] = None
    parent_phone: Optional[str] = Field(None, max_length=32)

    @field_validator('first_name', 'last_name')
    @classmethod
    def clean_names(cls, v: str) -> str:
        return utils.sanitize_text(v)

    @field_validator("parent_phone")
    @classmethod
    def clean_parent_phone(cls, v: Optional[str]) -> Optional[str]:
        return utils.normalize_phone_number(v)

class StudentCreate(StudentBase):
    class_id: UUID

class StudentUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(None, min_length=2, max_length=100)
    date_of_birth: Optional[date] = None
    class_id: Optional[UUID] = None
    parent_phone: Optional[str] = Field(None, max_length=32)

    @field_validator('first_name', 'last_name')
    @classmethod
    def clean_names(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return utils.sanitize_text(v)
        return v

    @field_validator("parent_phone")
    @classmethod
    def clean_parent_phone(cls, v: Optional[str]) -> Optional[str]:
        return utils.normalize_phone_number(v)

class StudentResponse(StudentBase):
    id: UUID
    silete_id: str
    org_id: UUID
    class_id: Optional[UUID] = None
    status: str
    admission_year: int
    
    class Config:
        from_attributes = True
