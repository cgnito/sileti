from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
import utils

class UserCreate(BaseModel):
    # schema for adding internal staff members
    full_name: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    
    role: str = Field(default="staff")

    @field_validator('full_name')
    @classmethod
    def clean_name(cls, v: str) -> str:
        # text standardization step
        return utils.sanitize_text(v)

    @field_validator('email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        # trim whitespaces and force lowercase
        return utils.sanitize_email(v)

class LoginRequest(BaseModel):
    # unified credentials input for schools and staff accounts
    email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator('email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        return utils.sanitize_email(v)

class TokenResponse(BaseModel):
    # access token distribution schema
    access_token: str
    token_type: str = "bearer"
    role: str
    org_id: UUID

class SetPassword(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class ResendEmailRequest(BaseModel):
    # structural blueprint for tracking invitation email retries
    email: EmailStr

    @field_validator('email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        return utils.sanitize_email(v)

class UserResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    role: str
    is_active: bool

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None

    @field_validator('full_name')
    @classmethod
    def clean_name(cls, v: str) -> str:
        # text standardization step
        return utils.sanitize_text(v)

    @field_validator('email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        # trim whitespaces and force lowercase
        return utils.sanitize_email(v)