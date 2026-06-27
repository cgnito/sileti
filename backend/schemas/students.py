from pydantic import BaseModel, Field, field_validator
from datetime import date
from typing import Optional
from uuid import UUID
import utils

class StudentBase(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    date_of_birth: Optional[date] = None

    @field_validator('first_name', 'last_name')
    @classmethod
    def clean_names(cls, v: str) -> str:
        return utils.sanitize_text(v)

class StudentCreate(StudentBase):
    class_id: UUID

class StudentUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(None, min_length=2, max_length=100)
    date_of_birth: Optional[date] = None
    class_id: Optional[UUID] = None

    @field_validator('first_name', 'last_name')
    @classmethod
    def clean_names(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return utils.sanitize_text(v)
        return v

class StudentResponse(StudentBase):
    id: UUID
    silete_id: str
    org_id: UUID
    class_id: UUID
    status: str
    admission_year: int
    
    class Config:
        from_attributes = True