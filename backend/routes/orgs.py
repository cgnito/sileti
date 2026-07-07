from uuid import UUID
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
import logging
from decimal import Decimal

from app import models, security
from services import utils
import schemas
from . import payments  
from app.database import get_db
from services import notifications

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orgs", tags=["Organizations"])

# -- HELPER FUNCTIONS -- #
def _normalize_nomba_bank_list(response_data: dict) -> list[dict[str, str]]:
    """Return the bank list in the shape expected by the frontend."""
    if not isinstance(response_data, dict):
        return []

    data = response_data.get("data") if response_data.get("data") is not None else response_data
    # data can be a dict with `results` or directly a list of banks
    if isinstance(data, dict):
        raw_banks = data.get("results") or []
    elif isinstance(data, list):
        raw_banks = data
    else:
        raw_banks = []

    mapped_banks: list[dict[str, str]] = []
    for item in raw_banks:
        if not isinstance(item, dict):
            continue

        bank_code = item.get("code")
        bank_name = item.get("name")
        if bank_code and bank_name:
            mapped_banks.append({
                "bank_name": str(bank_name),
                "bank_code": str(bank_code),
            })

    return mapped_banks


def _extract_lookup_account_name(response_data: dict, fallback: str = "unknown matching account") -> str:
    """Extract the resolved account name from the Nomba lookup response."""
    # Accept both the full response envelope or the data payload directly.
    if not isinstance(response_data, dict):
        return fallback

    data = response_data.get("data") if response_data.get("data") is not None else response_data
    if isinstance(data, dict):
        account_name = data.get("accountName") or data.get("account_name")
        if isinstance(account_name, str) and account_name.strip():
            return account_name.strip()

    return fallback


def send_verification_email_task(email: str, token: str):
    # background wrapper for non-blocking email deployment
    try:
        utils.send_verification_email(email, token)
        logger.info(f"successfully sent verification email to {email}")
    except Exception as e:
        logger.error(f"failed to send verification email to {email}: {str(e)}")


# -- ROUTE ENDPOINTS -- #
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
    successful_payments = db.query(models.PaymentLedger).filter(
        models.PaymentLedger.org_id == org_id,
        models.PaymentLedger.status == models.PaymentLedgerStatus.SUCCESS.value,
        models.PaymentLedger.amount.isnot(None),
    ).all()

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
    
    for payment in successful_payments:
        amount = payment.amount or Decimal("0.00")
        total_collected += amount
        if payment.created_at:
            bucket = bucket_map.get(payment.created_at.strftime("%Y-%m"))
            if bucket:
                bucket["collected"] = bucket["collected"] + amount

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


@router.get("/notifications", response_model=schemas.NotificationLogListResponse)
def list_notification_logs(
    query: Optional[str] = None,
    status: Optional[str] = None,
    event_type: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = 25,
    offset: int = 0,
    current_admin: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"])),
    db: Session = Depends(get_db),
):
    """
    Returns a paginated audit trail of outbound notification attempts for the current organization.
    """
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    base_query = db.query(models.NotificationLog).filter(models.NotificationLog.org_id == current_admin.org_id)

    if status:
        base_query = base_query.filter(models.NotificationLog.status == status.lower())
    if event_type:
        base_query = base_query.filter(models.NotificationLog.event_type == event_type.lower())
    if channel:
        base_query = base_query.filter(models.NotificationLog.channel == channel.lower())
    if query:
        search = f"%{query.strip().lower()}%"
        base_query = base_query.outerjoin(models.Student, models.Student.id == models.NotificationLog.student_id).outerjoin(
            models.Invoice, models.Invoice.id == models.NotificationLog.invoice_id
        ).outerjoin(
            models.SchoolClass, models.SchoolClass.id == models.Student.class_id
        ).filter(
            or_(
                models.NotificationLog.recipient_phone.ilike(search),
                models.NotificationLog.recipient_email.ilike(search),
                models.NotificationLog.message_sid.ilike(search),
                models.NotificationLog.event_type.ilike(search),
                models.NotificationLog.status.ilike(search),
                models.Student.first_name.ilike(search),
                models.Student.last_name.ilike(search),
                models.Student.silete_id.ilike(search),
                models.SchoolClass.name.ilike(search),
                models.Invoice.session.ilike(search),
                models.Invoice.term.ilike(search),
            )
        )

    total = base_query.count()
    summary_rows = db.query(
        models.NotificationLog.status,
        func.count(models.NotificationLog.status),
    ).filter(
        models.NotificationLog.org_id == current_admin.org_id
    )
    if status:
        summary_rows = summary_rows.filter(models.NotificationLog.status == status.lower())
    if event_type:
        summary_rows = summary_rows.filter(models.NotificationLog.event_type == event_type.lower())
    if channel:
        summary_rows = summary_rows.filter(models.NotificationLog.channel == channel.lower())
    if query:
        search = f"%{query.strip().lower()}%"
        summary_rows = summary_rows.outerjoin(models.Student, models.Student.id == models.NotificationLog.student_id).outerjoin(
            models.Invoice, models.Invoice.id == models.NotificationLog.invoice_id
        ).outerjoin(
            models.SchoolClass, models.SchoolClass.id == models.Student.class_id
        ).filter(
            or_(
                models.NotificationLog.recipient_phone.ilike(search),
                models.NotificationLog.recipient_email.ilike(search),
                models.NotificationLog.message_sid.ilike(search),
                models.NotificationLog.event_type.ilike(search),
                models.NotificationLog.status.ilike(search),
                models.Student.first_name.ilike(search),
                models.Student.last_name.ilike(search),
                models.Student.silete_id.ilike(search),
                models.SchoolClass.name.ilike(search),
                models.Invoice.session.ilike(search),
                models.Invoice.term.ilike(search),
            )
        )
    summary = {key: 0 for key in ["sent", "failed", "skipped"]}
    for status_value, count in summary_rows.group_by(models.NotificationLog.status).all():
        summary[status_value] = int(count)
    summary["total"] = int(total)

    logs = base_query.order_by(models.NotificationLog.created_at.desc()).offset(offset).limit(limit).all()

    items = []
    for log in logs:
        student = db.query(models.Student).filter(models.Student.id == log.student_id).first() if log.student_id else None
        school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == student.class_id).first() if student and student.class_id else None
        invoice = db.query(models.Invoice).filter(models.Invoice.id == log.invoice_id).first() if log.invoice_id else None

        items.append(
            {
                "id": log.id,
                "idempotency_key": log.idempotency_key,
                "org_id": log.org_id,
                "student_id": log.student_id,
                "invoice_id": log.invoice_id,
                "channel": log.channel,
                "event_type": log.event_type,
                "recipient_phone": log.recipient_phone,
                "recipient_email": log.recipient_email,
                "message_sid": log.message_sid,
                "status": log.status,
                "error_message": log.error_message,
                "created_at": log.created_at,
                "student_name": f"{student.first_name} {student.last_name}" if student else None,
                "class_name": school_class.name if school_class else None,
                "invoice": (
                    {
                        "id": invoice.id,
                        "session": invoice.session,
                        "term": invoice.term,
                        "total_amount": invoice.total_amount,
                        "paid_amount": invoice.paid_amount,
                        "status": invoice.status.value if hasattr(invoice.status, "value") else invoice.status,
                    }
                    if invoice
                    else None
                ),
            }
        )

    return {"items": items, "total": total, "limit": limit, "offset": offset, "summary": summary}


@router.post("/notifications/{notification_id}/resend", response_model=schemas.NotificationLogResponse)
def resend_notification(
    notification_id: UUID,
    current_admin: security.AuthContext = Depends(security.RoleChecker(["admin", "staff"])),
    db: Session = Depends(get_db),
):
    notification = db.query(models.NotificationLog).filter(
        models.NotificationLog.id == notification_id,
        models.NotificationLog.org_id == current_admin.org_id,
    ).first()

    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification record not found")

    if notification.status == "sent":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This notification has already been sent.")

    try:
        updated = notifications.resend_notification_attempt(db, notification.id, current_admin.org_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    student = db.query(models.Student).filter(models.Student.id == updated.student_id).first() if updated.student_id else None
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == student.class_id).first() if student and student.class_id else None
    invoice = db.query(models.Invoice).filter(models.Invoice.id == updated.invoice_id).first() if updated.invoice_id else None

    return {
        "id": updated.id,
        "idempotency_key": updated.idempotency_key,
        "org_id": updated.org_id,
        "student_id": updated.student_id,
        "invoice_id": updated.invoice_id,
        "channel": updated.channel,
        "event_type": updated.event_type,
        "recipient_phone": updated.recipient_phone,
        "recipient_email": updated.recipient_email,
        "message_sid": updated.message_sid,
        "status": updated.status,
        "error_message": updated.error_message,
        "created_at": updated.created_at,
        "student_name": f"{student.first_name} {student.last_name}" if student else None,
        "class_name": school_class.name if school_class else None,
        "invoice": (
            {
                "id": invoice.id,
                "session": invoice.session,
                "term": invoice.term,
                "total_amount": invoice.total_amount,
                "paid_amount": invoice.paid_amount,
                "status": invoice.status.value if hasattr(invoice.status, "value") else invoice.status,
            }
            if invoice
            else None
        ),
    }


# get supported banks and perform account lookups via nomba api
@router.get("/banks", status_code=status.HTTP_200_OK)
def get_supported_banks(
    current_admin: security.AuthContext = Depends(security.allow_admin_only) #maybe
):
    """
    proxies supported banks list directly from the nomba api to populate frontend dropdown grids.
    """
    try:
        response_data = payments.make_nomba_request(method="GET", endpoint="v1/transfers/banks")
        mapped = _normalize_nomba_bank_list(response_data)
        return mapped
    except Exception as e:
        logger.error("failed to retrieve banks list from nomba provider: %s", str(e))
        fallback_banks = [
            {"bank_name": "Guaranty Trust Bank", "bank_code": "058"},
            {"bank_name": "Zenith Bank", "bank_code": "057"},
            {"bank_name": "Access Bank", "bank_code": "044"},
        ]
        return fallback_banks



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
        
        response_data = payments.make_nomba_request(
            method="POST",
            endpoint="v1/transfers/bank/lookup",
            payload=payload
        )
        name = _extract_lookup_account_name(response_data)

        return {
            "account_number": lookup_input.account_number,
            "account_name": name,
            "bank_code": lookup_input.bank_code,
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


@router.post("/bank-settlement", response_model=schemas.BankSettlementResponse)
def submit_bank_settlement(
    bank_input: schemas.BankSettlementCreate,
    current_admin: security.AuthContext = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    """
    Submit the bank settlement details for the current school and persist the result.
    """
    org = current_admin.organization
    if not org:
        org = db.query(models.Organization).filter(models.Organization.id == current_admin.org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="organization record missing")

    settlement = db.query(models.BankSettlement).filter(models.BankSettlement.org_id == org.id).first()
    if not settlement:
        settlement = models.BankSettlement(org_id=org.id)
        db.add(settlement)

    settlement.bank_name = bank_input.bank_name
    settlement.bank_code = bank_input.bank_code
    settlement.account_number = bank_input.account_number
    settlement.account_name = bank_input.account_name

    org.has_setup_bank = True

    db.commit()
    db.refresh(settlement)
    return settlement


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
                endpoint="v1/transfers/bank/lookup",
                payload=payload,
            )
            update_data["account_name"] = _extract_lookup_account_name(response_data, settlement.account_name)
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
