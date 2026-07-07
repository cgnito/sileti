from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from typing import List, Optional
from services import utils

class ClassBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50, examples=["JSS 1 Gold"])
    level: int = Field(..., gt=0, le=20, description="The numeric grade level for sorting and promotion")

    @field_validator('name')
    @classmethod
    def clean_class_name(cls, v: str) -> str:
        return utils.sanitize_text(v)

class ClassCreate(ClassBase):
    pass

class ClassResponse(ClassBase):
    id: UUID
    org_id: UUID

    class Config:
        from_attributes = True

class ClassUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    level: Optional[int] = Field(None, gt=0, le=20)

    @field_validator('name')
    @classmethod
    def clean_class_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return utils.sanitize_text(v)
        return v