from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
import utils

class OrgCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    short_code: Optional[str] = Field(None, min_length=2, max_length=10)
    admin_email: EmailStr
    admin_full_name: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8)

    @field_validator('name', 'admin_full_name')
    @classmethod
    def clean_name_fields(cls, v: str) -> str:
        return utils.sanitize_text(v)

    @field_validator('short_code')
    @classmethod
    def clean_code(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return utils.sanitize_short_code(v)
        return v

    @field_validator('admin_email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        return utils.sanitize_email(v)

class EmailVerification(BaseModel):
    email: EmailStr
    
    @field_validator('email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        return utils.sanitize_email(v)

class OrgResponse(BaseModel): 
    id: UUID
    name: str
    short_code: str
    slug: str
    
    class Config:
        from_attributes = True

# Schema for updating organization profile
class OrgUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=100)

    @field_validator('name')
    @classmethod
    def clean_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return utils.sanitize_text(v)
        return v