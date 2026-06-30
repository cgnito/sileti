from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
import logging

import models
import schemas
import utils
import security
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



# todo 
@router.get("/banks", status_code=status.HTTP_200_OK)
def get_supported_banks(
    current_admin: security.AuthContext = Depends(security.allow_admin_only) #maybe
):
    """
    proxies supported banks list directly from the nomba api to populate frontend dropdown grids.
    """
    try:
        # todo: replace this placeholder array with your active nomba client request execution
        # mock response to unblock frontend dropdown testing for the hackathon context
        mock_banks = [
            {"bank_name": "Access Bank", "bank_code": "044"},
            {"bank_name": "Guaranty Trust Bank", "bank_code": "058"},
            {"bank_name": "Zenith Bank", "bank_code": "057"},
            {"bank_name": "Nomba Bank", "bank_code": "999"}
        ]
        return mock_banks
    except Exception as e:
        logger.error(f"failed to retrieve banks list from nomba provider: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="failed to retrieve banking channels list from payment partner"
        )



# todo 
@router.post("/bank-lookup", response_model=schemas.BankAccountLookupResponse)
def verify_bank_account_name(
    lookup_input: schemas.BankAccountLookupRequest,
    current_admin: security.AuthContext = Depends(security.allow_admin_only) #maybe
):
    """
    performs a real-time account lookup via nomba api before form submission.
    """
    try:
        # todo: implement the outbound nomba oauth token header and api request here
        # placeholder response mimicking a successful account matching lookup loop
        resolved_name = "GREENWOOD ACADEMY TEST ACCOUNT"
        
        return {
            "account_number": lookup_input.account_number,
            "account_name": resolved_name,
            "bank_code": lookup_input.bank_code
        }
    except Exception as e:
        logger.error(f"nomba account verification routine failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="could not resolve account details. please verify parameters."
        )


# todo
@router.post("/bank-settlement", response_model=schemas.BankSettlementResponse, status_code=status.HTTP_201_CREATED)
def setup_bank_settlement(
    bank_input: schemas.BankSettlementCreate,
    current_admin: security.AuthContext = Depends(security.allow_admin_only),
    db: Session = Depends(get_db)
):
    """
    registers validated banking data and creates an isolated subaccount routing target.
    """
    org = current_admin.organization
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="organization record missing"
        )

    # prevent duplicated configurations if a banking settlement row already exists
    existing_bank = db.query(models.BankSettlement).filter(models.BankSettlement.org_id == org.id).first()
    if existing_bank:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="bank settlement records have already been registered for this school"
        )

    # todo: trigger nomba api method to provision a subaccount tracking token for this target
    generated_subaccount_id = f"sub_acc_{utils.generate_short_code(org.school_name).lower()}"

    # compile and insert the database record mapping
    new_settlement = models.BankSettlement(
        org_id=org.id,
        bank_name=bank_input.bank_name,
        account_number=bank_input.account_number,
        account_name=bank_input.account_name,
        nomba_subaccount_id=generated_subaccount_id
    )

    # modify flag status on parent org profile row to confirm completion of step
    org.has_setup_bank = True

    db.add(new_settlement)
    db.commit()
    db.refresh(new_settlement)

    return new_settlement

# todo: implement a PATCH endpoint to modify existing bank settlement details and trigger nomba subaccount update if necessary
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
            status_code=status.HTTP_444_NOT_FOUND,
            detail="no bank settlement record found to update. please create one first."
        )

    # extract only the fields the frontend explicitly sent over
    update_data = bank_update.model_dump(exclude_unset=True)

    # loop and apply modifications dynamically
    for key, value in update_data.items():
        setattr(settlement, key, value)

    # todo: if account number or bank changed, trigger a fresh nomba subaccount modification api call here

    db.commit()
    db.refresh(settlement)
    return settlement