from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
import utils
import models

class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    role: models.UserRole = Field(examples=["bursar"])

    @field_validator('full_name')
    @classmethod
    def clean_name(cls, v: str) -> str:
        return utils.sanitize_text(v)

    @field_validator('email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        return utils.sanitize_email(v)

class SetPassword(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class UserResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    role: models.UserRole
    is_active: bool

    class Config:
        from_attributes = True

# Schema for staff members updating their profile
class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None

    @field_validator('full_name')
    @classmethod
    def clean_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return utils.sanitize_text(v)
        return v

    @field_validator('email')
    @classmethod
    def clean_email(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return utils.sanitize_email(v)
        return v