from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
import utils

class OrgCreate(BaseModel):
    # school registration input parameters
    school_name: str = Field(..., min_length=3, max_length=100)
    short_code: Optional[str] = Field(None, min_length=2, max_length=10)
    school_email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator('school_name')
    @classmethod
    def clean_name_fields(cls, v: str) -> str:
        # uniform title casing for school names
        return utils.sanitize_text(v)

    @field_validator('short_code')
    @classmethod
    def clean_code(cls, v: Optional[str]) -> Optional[str]:
        if v:
            # force spacing removal and uppercase matching
            return utils.sanitize_short_code(v)
        return v

    @field_validator('school_email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        # strip and lowercase incoming email
        return utils.sanitize_email(v)

class EmailVerification(BaseModel):
    email: EmailStr
    
    @field_validator('email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        # standard validation clean pipeline
        return utils.sanitize_email(v)

class OrgResponse(BaseModel): 
    id: UUID
    school_name: str
    short_code: str
    school_email: EmailStr
    slug: Optional[str] = None

    class Config:
        from_attributes = True

class OrgUpdate(BaseModel):
    school_name: Optional[str] = Field(None, min_length=3, max_length=100)
    short_code: Optional[str] = Field(None, min_length=2, max_length=10)
    school_email: Optional[EmailStr] = None

    @field_validator('school_name')
    @classmethod
    def clean_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return utils.sanitize_text(v)
        return v
    

# bank settlement related schemas for onboarding flow

# validates incoming bank settlement setup data from the frontend dropdown and verification lookup
class BankSettlementCreate(BaseModel):
    bank_name: str = Field(..., min_length=2, max_length=100, examples=["Nomba Bank"])
    bank_code: Optional[str] = Field(None, max_length=20, examples=["058"])
    
    # enforces exactly 10 numeric digits for Nigerian NUBAN numbers
    account_number: str = Field(
        ..., 
        min_length=10, 
        max_length=10, 
        pattern=r"^\d{10}$",
        description="10-digit NUBAN account number", 
        examples=["0123456789"]
    )
    
    # automatically resolved from server-side bank verification lookup API
    account_name: str = Field(..., min_length=3, max_length=255, examples=["Greenwood Academy Main"])

    @field_validator('bank_name', 'account_name')
    @classmethod
    def clean_bank_text(cls, v: str) -> str:
        import utils
        return utils.sanitize_text(v)


# outbound response formatting after successfully saving bank details
class BankSettlementResponse(BankSettlementCreate):
    id: UUID
    org_id: UUID
    nomba_virtual_account_ref: Optional[str] = None
    nomba_virtual_account_number: Optional[str] = None
    nomba_virtual_account_name: Optional[str] = None
    nomba_virtual_account_bank_name: Optional[str] = None

    class Config:
        from_attributes = True


# validates request parameters for the live real-time account name verification endpoint
class BankAccountLookupRequest(BaseModel):
    bank_code: str = Field(..., description="The unique code of the selected bank (e.g., '058' for GTB)")
    account_number: str = Field(..., min_length=10, max_length=10, pattern=r"^\d{10}$")


# formats the resolved response from Nomba API back to the frontend form layout
class BankAccountLookupResponse(BaseModel):
    account_number: str
    account_name: str
    bank_code: str


# validates incoming modifications to existing bank settlement settings
class BankSettlementUpdate(BaseModel):
    bank_name: Optional[str] = Field(None, min_length=2, max_length=100, examples=["Nomba Bank"])
    bank_code: Optional[str] = Field(None, max_length=20, examples=["058"])
    account_number: Optional[str] = Field(
        None, 
        min_length=10, 
        max_length=10, 
        pattern=r"^\d{10}$",
        description="10-digit NUBAN account number", 
        examples=["0123456789"]
    )
    account_name: Optional[str] = Field(None, min_length=3, max_length=255, examples=["Greenwood Academy Main"])

    @field_validator('bank_name', 'account_name')
    @classmethod
    def clean_update_bank_text(cls, v: Optional[str]) -> Optional[str]:
        if v:
            import utils
            return utils.sanitize_text(v)
        return v


# individual breakdown checkboxes tracking current wizard checklist progress
class OnboardingStepsStatus(BaseModel):
    email_verified: bool
    bank_settlement: bool
    classes_created: bool
    students_added: bool
    fees_configured: bool


# master payload structure returned to the frontend dashboard guard
class OnboardingStatusResponse(BaseModel):
    is_completed: bool
    steps: OnboardingStepsStatus


class DashboardTrendPoint(BaseModel):
    label: str
    billed: float
    collected: float


class DashboardBreakdownPoint(BaseModel):
    label: str
    value: int


class DashboardSummary(BaseModel):
    students_count: int
    classes_count: int
    fee_templates_count: int
    invoices_count: int
    paid_invoices_count: int
    unpaid_invoices_count: int
    partially_paid_invoices_count: int
    voided_invoices_count: int
    total_income: float
    total_collected: float
    total_outstanding: float
    collection_rate_pct: float


class DashboardMetricsResponse(BaseModel):
    summary: DashboardSummary
    invoice_breakdown: list[DashboardBreakdownPoint]
    revenue_trend: list[DashboardTrendPoint]
