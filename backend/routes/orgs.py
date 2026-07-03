from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
import logging
from decimal import Decimal

import models
import schemas
import utils
import security
from . import payments  
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orgs", tags=["Organizations"])

def send_verification_email_task(email: str, token: str):
    # background wrapper for non-blocking email deployment
    try:
        utils.send_verification_email(email, token)
        logger.info(f"successfully sent verification email to {email}")
    except Exception as e:
        logger.error(f"failed to send verification email to {email}: {str(e)}")



@router.post("", status_code=status.HTTP_201_CREATED)
def register_school(
    org_input: schemas.OrgCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
): 
    # normalize entry inputs to secure database consistency
    normalized_email = org_input.school_email.lower().strip() if org_input.school_email else ""

    # auto-generate short code using utility if not explicitly provided by the user
    if not org_input.short_code or not org_input.short_code.strip():
        generated_code = utils.generate_short_code(org_input.school_name)
    else:
        generated_code = org_input.short_code

    normalized_code = generated_code.upper().strip()

    # block email collision across schools
    if db.query(models.Organization).filter(models.Organization.school_email == normalized_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="a school with this email already exists"
        )

    # block code duplicate entries using the evaluated code string
    if db.query(models.Organization).filter(models.Organization.short_code == normalized_code).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="a school with this short code already exists. try specifying a custom short code."
        )

    # auto-generate lowercase hyphenated slug from school name fallback string
    generated_slug = org_input.school_name.lower().replace(" ", "-").strip("-")

    new_org = models.Organization(
        school_name=org_input.school_name,
        short_code=normalized_code,
        school_email=normalized_email,
        hashed_password=security.get_password_hash(org_input.password),
        slug=generated_slug
    )
    
    db.add(new_org)
    db.commit()
    db.refresh(new_org)

    # non-blocking verification token transmission
    token = security.create_verification_token(new_org.school_email)
    background_tasks.add_task(send_verification_email_task, new_org.school_email, token)

    return {
        "message": "school registration successful. verification email sent.",
        "role": "admin",
        "org_id": str(new_org.id)
    }





@router.get("/my-school", response_model=schemas.OrgResponse)
def get_my_school(
    current_admin: security.AuthContext = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    # pull linked object data from current admin session context
    if not current_admin.organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="organization profile record missing"
        )
    return current_admin.organization




@router.patch("/my-school", response_model=schemas.OrgResponse)
def update_my_school(
    org_update: schemas.OrgUpdate,
    current_admin: security.AuthContext = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    org = current_admin.organization
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="organization profile record missing"
        )

    update_data = org_update.model_dump(exclude_unset=True)

    # maintain clean routing slugs dynamically if the name modifies
    if "school_name" in update_data and update_data["school_name"]:
        update_data["slug"] = update_data["school_name"].lower().replace(" ", "-").strip("-")

    for key, value in update_data.items():
        setattr(org, key, value)

    db.commit()
    db.refresh(org)
    return org



# onboarding status and bank management endpoints
@router.get("/onboarding-status", response_model=schemas.OnboardingStatusResponse)
def get_onboarding_status(
    current_admin: security.AuthContext = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    """
    dynamically evaluates database tables to track wizard checklist progress.
    prevents frontend and backend tracking states from falling out of sync.
    """
    org = current_admin.organization
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="organization record missing"
        )
        
    # verify email validation state from your model flag
    email_ok = org.is_verified

    # verify if payout banking details are registered
    bank_ok = org.has_setup_bank

    # verify if at least one class arm has been built inside the database
    has_classes = db.query(models.SchoolClass).filter(models.SchoolClass.org_id == org.id).first() is not None

    # verify if at least one student profile exists inside the database
    has_students = db.query(models.Student).filter(models.Student.org_id == org.id).first() is not None

    # verify if at least one fee template has been created by the administrator
    has_fees = db.query(models.FeeTemplate).filter(models.FeeTemplate.org_id == org.id).first() is not None

    # evaluation turns true only when every single checklist milestone is finished
    completed_state = all([email_ok, bank_ok, has_classes, has_students, has_fees])

    # synchronize the core organization completion flag state permanently
    if org.is_onboarding_completed != completed_state:
        org.is_onboarding_completed = completed_state
        db.commit()

    return {
        "is_completed": completed_state,
        "steps": {
            "email_verified": email_ok,
            "bank_settlement": bank_ok,
            "classes_created": has_classes,
            "students_added": has_students,
            "fees_configured": has_fees
        }
    }


@router.get("/dashboard-metrics", response_model=schemas.DashboardMetricsResponse)
def get_dashboard_metrics(
    current_admin: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"])),
    db: Session = Depends(get_db)
):
    """
    Returns the school's financial snapshot and chart-ready data for the main dashboard.
    """
    org_id = current_admin.org_id

    students_count = db.query(models.Student).filter(models.Student.org_id == org_id).count()
    classes_count = db.query(models.SchoolClass).filter(models.SchoolClass.org_id == org_id).count()
    fee_templates_count = db.query(models.FeeTemplate).filter(models.FeeTemplate.org_id == org_id).count()

    invoices = db.query(models.Invoice).filter(models.Invoice.org_id == org_id).all()

    summary_counts = {
        "paid": 0,
        "unpaid": 0,
        "partial": 0,
        "voided": 0,
    }

    total_income = Decimal("0.00")
    total_collected = Decimal("0.00")

    now = datetime.now().replace(day=1)
    buckets: list[dict[str, object]] = []
    bucket_map: dict[str, dict[str, object]] = {}

    for offset in range(5, -1, -1):
        year = now.year
        month = now.month - offset
        while month <= 0:
            year -= 1
            month += 12
        month_dt = datetime(year, month, 1)
        key = month_dt.strftime("%Y-%m")
        bucket = {
            "key": key,
            "label": month_dt.strftime("%b '%y"),
            "billed": Decimal("0.00"),
            "collected": Decimal("0.00"),
        }
        buckets.append(bucket)
        bucket_map[key] = bucket

    for invoice in invoices:
        if invoice.status == models.InvoiceStatus.PAID:
            summary_counts["paid"] += 1
        elif invoice.status == models.InvoiceStatus.PARTIAL:
            summary_counts["partial"] += 1
        elif invoice.status == models.InvoiceStatus.VOIDED:
            summary_counts["voided"] += 1
        else:
            summary_counts["unpaid"] += 1

        if invoice.status != models.InvoiceStatus.VOIDED:
            total_income += invoice.total_amount
            if invoice.created_at:
                bucket = bucket_map.get(invoice.created_at.strftime("%Y-%m"))
                if bucket:
                    bucket["billed"] = bucket["billed"] + invoice.total_amount
                    bucket["collected"] = bucket["collected"] + invoice.paid_amount

        total_collected += invoice.paid_amount

    total_outstanding = max(total_income - total_collected, Decimal("0.00"))
    collection_rate_pct = float((total_collected / total_income * Decimal("100")) if total_income > 0 else Decimal("0.00"))

    return {
        "summary": {
            "students_count": students_count,
            "classes_count": classes_count,
            "fee_templates_count": fee_templates_count,
            "invoices_count": len(invoices),
            "paid_invoices_count": summary_counts["paid"],
            "unpaid_invoices_count": summary_counts["unpaid"],
            "partially_paid_invoices_count": summary_counts["partial"],
            "voided_invoices_count": summary_counts["voided"],
            "total_income": float(total_income),
            "total_collected": float(total_collected),
            "total_outstanding": float(total_outstanding),
            "collection_rate_pct": collection_rate_pct,
        },
        "invoice_breakdown": [
            {"label": "Paid", "value": summary_counts["paid"]},
            {"label": "Unpaid", "value": summary_counts["unpaid"]},
            {"label": "Partially paid", "value": summary_counts["partial"]},
            {"label": "Voided", "value": summary_counts["voided"]},
        ],
        "revenue_trend": [
            {
                "label": bucket["label"],
                "billed": float(bucket["billed"]),
                "collected": float(bucket["collected"]),
            }
            for bucket in buckets
        ],
    }

# -- TO FIX ----

# get supported banks and perform account lookups via nomba api
@router.get("/banks", status_code=status.HTTP_200_OK)
def get_supported_banks(
    current_admin: security.AuthContext = Depends(security.allow_admin_only) #maybe
):
    """
    proxies supported banks list directly from the nomba api to populate frontend dropdown grids.
    """
    try:
        # trigger outbound live proxy query against nomba's sandbox transfers bank list route
        response_data = payments.make_nomba_request(method="GET", endpoint="v2/transfers/banks")
        
        # parse incoming response array and map parameters to match frontend key properties
        raw_banks = response_data.get("data", {}).get("results", [])
        mapped_banks = [
            {"bank_name": item["name"], "bank_code": item["code"]} for item in raw_banks
        ]
        return mapped_banks
    except Exception as e:
        logger.error(f"failed to retrieve banks list from nomba provider: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="failed to retrieve banking channels list from payment partner"
        )



# verify bank account name via nomba api before form submission
@router.post("/bank-lookup", response_model=schemas.BankAccountLookupResponse)
def verify_bank_account_name(
    lookup_input: schemas.BankAccountLookupRequest,
    current_admin: security.AuthContext = Depends(security.allow_admin_only) #maybe
):
    """
    performs a real-time account lookup via nomba api before form submission.
    """
    try:
        # pack user context into standard validation model payload body mapping rules
        payload = {
            "accountNumber": lookup_input.account_number,
            "bankCode": lookup_input.bank_code
        }
        
        # fire standard post request targeting sandbox lookup validation channel
        response_data = payments.make_nomba_request(
            method="POST", 
            endpoint="v2/transfers/bank/lookup", 
            payload=payload
        )
        
        resolved_data = response_data.get("data", {})
        
        return {
            "account_number": lookup_input.account_number,
            "account_name": resolved_data.get("accountName", "unknown matching account"),
            "bank_code": lookup_input.bank_code
        }
    except Exception as e:
        logger.error(f"nomba account verification routine failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="could not resolve account details. please verify parameters."
        )


# get bank settlement details for the current school organization
@router.get("/bank-settlement", response_model=schemas.BankSettlementResponse | None)
def get_bank_settlement(
    current_admin: security.AuthContext = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    org = current_admin.organization
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="organization record missing")

    settlement = db.query(models.BankSettlement).filter(models.BankSettlement.org_id == org.id).first()
    if not settlement:
        return None

    return settlement


# submit bank settlement details for the current school organization and create a nomba va under the sub account
# i'll need to update the models for va account name and reference, might need to update schemas too




# update existing bank settlement details for the current school organization and synchronize with nomba
@router.patch("/bank-settlement", response_model=schemas.BankSettlementResponse)
def update_bank_settlement(
    bank_update: schemas.BankSettlementUpdate,
    current_admin: security.AuthContext = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    """
    modifies existing banking settlement details and synchronizes with database.
    """
    org = current_admin.organization
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="organization record missing"
        )

    # find the existing settlement profile row
    settlement = db.query(models.BankSettlement).filter(models.BankSettlement.org_id == org.id).first()
    if not settlement:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="no bank settlement record found to update. please create one first."
        )

    # extract only the fields the frontend explicitly sent over
    update_data = bank_update.model_dump(exclude_unset=True)

    # validation step: if account parameters changed, verify details with nomba first before committing
    new_account = update_data.get("account_number", settlement.account_number)
    new_bank = update_data.get("bank_code", settlement.bank_code)

    if "account_number" in update_data or "bank_code" in update_data:
        try:
            payload = {
                "accountNumber": new_account,
                "bankCode": new_bank
            }
            # hit nomba API sandbox to run verification check routine
            response_data = payments.make_nomba_request(
                method="POST", 
                endpoint="v2/transfers/bank/lookup", 
                payload=payload
            )
            resolved_data = response_data.get("data", {})
            # automatically override the name to ensure compliance with central switch lookup
            update_data["account_name"] = resolved_data.get("accountName", settlement.account_name)
        except Exception as e:
            logger.error(f"failed to validate updated account configurations with nomba: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="could not resolve updated banking details. please verify account parameters."
            )

    # loop and apply modifications dynamically
    for key, value in update_data.items():
        setattr(settlement, key, value)


    db.commit()
    db.refresh(settlement)
    return settlement
