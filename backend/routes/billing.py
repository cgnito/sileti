from decimal import Decimal
from datetime import date
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload, joinedload

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/billing", tags=["Billing Engine"])


def sync_invoice_status(invoice: models.Invoice) -> None:
    """
    Helper function to dynamically re-evaluate and sync an invoice's status 
    whenever its total financial obligations or paid balances shift.
    """
    if invoice.status == models.InvoiceStatus.VOIDED:
        return

    if invoice.paid_amount == 0:
        invoice.status = models.InvoiceStatus.UNPAID
    elif invoice.paid_amount >= invoice.total_amount:
        invoice.status = models.InvoiceStatus.PAID
    else:
        invoice.status = models.InvoiceStatus.PARTIAL



# GENERATE BATCH INVOICES (WITH MULTI-CLICK & IDEMPOTENCY GUARDS)
@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_invoices(
    request: schemas.InvoiceGenerationRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    """
    Executes batch invoice generation for an entire active class roster.
    Guards against duplicate generation or accidental multi-clicks.
    Ignoring voided statements allows seamless 'Void and Regenerate' workflows.
    """
    # Fetch template catalog blueprint and eagerly load its component line items
    template = db.query(models.FeeTemplate).options(
        selectinload(models.FeeTemplate.line_items)
    ).filter(
        models.FeeTemplate.id == request.template_id,
        models.FeeTemplate.org_id == current_user.org_id,
        models.FeeTemplate.deleted_at == None
    ).first()

    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee template not found")

    # Fetch target class roster (only bill ACTIVE students)
    active_students = db.query(models.Student).filter(
        models.Student.org_id == current_user.org_id,
        models.Student.class_id == request.class_id,
        models.Student.status == models.StudentStatus.ACTIVE
    ).all()

    if not active_students:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="No active students found in this class to bill."
        )

    # STRICT COMPOSITE IDEMPOTENCY GUARD
    student_ids = [student.id for student in active_students]
    existing_invoice = db.query(models.Invoice).filter(
        models.Invoice.org_id == current_user.org_id,
        models.Invoice.session == request.session,
        models.Invoice.term == request.term,
        models.Invoice.student_id.in_(student_ids),
        models.Invoice.status != models.InvoiceStatus.VOIDED  # Safe Enum evaluation tracking
    ).first()

    if existing_invoice:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoices have already been generated for this class for the {request.term} ({request.session}). Please manage existing invoices or void them before regenerating."
        )

    # Convert optional allocations into a quick hash map lookup
    allocations_map = {
        alloc.student_id: set(alloc.selected_line_item_ids)
        for alloc in request.optional_allocations
    }

    invoices_created = 0

    # Build student invoice statements atomically
    for student in active_students:
        total_amount = Decimal("0.00")
        details_to_add = []
        selected_ids = allocations_map.get(student.id, set())

        for item in template.line_items:
            # Item is attached if it is compulsory OR explicitly checked for this student
            if item.is_compulsory or item.id in selected_ids:
                detail = models.InvoiceDetail(
                    name=item.name,
                    amount=item.amount
                )
                details_to_add.append(detail)
                total_amount += item.amount

        invoice = models.Invoice(
            org_id=current_user.org_id,
            student_id=student.id,
            session=request.session,
            term=request.term,
            total_amount=total_amount,
            paid_amount=Decimal("0.00"),
            status=models.InvoiceStatus.UNPAID,
            due_date=request.due_date
        )
        invoice.items = details_to_add
        db.add(invoice)
        invoices_created += 1

    db.commit()
    return {
        "message": f"Successfully generated {invoices_created} invoices for the class.",
        "count": invoices_created
    }



# VOID SINGLE INVOICE INDIVIDUALLY
@router.post("/invoices/{invoice_id}/void", status_code=status.HTTP_200_OK)
def void_single_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    """
    Cancels/Voids a single individual invoice statement.
    Financial Guard: Blocks the cancellation if money has already been collected against it.
    """
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.org_id == current_user.org_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice record not found")

    if invoice.status == models.InvoiceStatus.VOIDED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invoice is already voided.")

    # Prevent erasing paper trails if payments exist
    if invoice.paid_amount > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot void an invoice that has active payments recorded against it. Refund or reverse transactions first."
        )

    invoice.status = models.InvoiceStatus.VOIDED
    
    db.commit()
    return {"message": "Invoice has been successfully voided and removed from active collections."}



# BATCH VOID ENTIRE CLASS RUN (FOR REGENERATION)
@router.post("/classes/{class_id}/void", status_code=status.HTTP_200_OK)
def void_class_invoices(
    class_id: UUID,
    session: str,
    term: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    """
    Mass-cancels/Voids all active invoices for a specific class, term, and session.
    Unlocks the ability to immediately re-run the generator with a corrected template.
    """
    invoices = db.query(models.Invoice).join(models.Student).filter(
        models.Invoice.org_id == current_user.org_id,
        models.Invoice.session == session,
        models.Invoice.term == term,
        models.Student.class_id == class_id,
        models.Invoice.status != models.InvoiceStatus.VOIDED
    ).all()

    if not invoices:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="No active invoices found matching these parameters to void."
        )

    voided_count = 0
    for invoice in invoices:
        # Financial Guard: Prevent canceling invoices that already have money logged against them
        if invoice.paid_amount > 0:
            continue
        invoice.status = models.InvoiceStatus.VOIDED
        voided_count += 1

    db.commit()
    return {"message": f"Successfully voided {voided_count} unpaid invoices for this class configuration."}



# APPEND OPTIONAL FEE TO INVOICE (WITH AUTO STATUS SYNC)
@router.post("/invoices/{invoice_id}/items", response_model=schemas.InvoiceResponse)
def append_optional_fee_to_invoice(
    invoice_id: UUID,
    payload: schemas.AddOptionalItemRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    """
    Appends an individual optional catalog item directly onto a student's active invoice profile.
    Automatically increments financial totals and syncs status fields securely.
    """
    invoice = db.query(models.Invoice).options(
        selectinload(models.Invoice.items)
    ).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.org_id == current_user.org_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice record not found")

    if invoice.status == models.InvoiceStatus.VOIDED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot mutate a voided invoice statement.")

    target_item = db.query(models.FeeLineItem).filter(models.FeeLineItem.id == payload.fee_line_item_id).first()
    if not target_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee configuration item not found")

    # Guard against duplicate billing line entries
    for existing_item in invoice.items:
        if existing_item.name == target_item.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"This invoice already includes an assignment for '{target_item.name}'."
            )

    new_detail = models.InvoiceDetail(name=target_item.name, amount=target_item.amount)
    invoice.items.append(new_detail)
    invoice.total_amount += target_item.amount  

    sync_invoice_status(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice



# 4. REMOVE OPTIONAL FEE FROM INVOICE (WITH AUTO STATUS SYNC)
@router.delete("/invoices/{invoice_id}/items/{item_id}", response_model=schemas.InvoiceResponse)
def remove_fee_item_from_invoice(
    invoice_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    """
    Removes a specific sub-cost item directly from a student's invoice ledger statement.
    Deducts item price from master total and automatically re-evaluates payment statuses.
    """
    invoice = db.query(models.Invoice).options(
        selectinload(models.Invoice.items)
    ).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.org_id == current_user.org_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice record not found")

    if invoice.status == models.InvoiceStatus.VOIDED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot alter a voided invoice statement.")

    # Locate targeted sub-item item inside the pre-loaded items array
    target_detail = None
    for item in invoice.items:
        if item.id == item_id:
            target_detail = item
            break

    if not target_detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Line item entry not found on this invoice.")

    # Deduct financial metrics before breaking relations
    invoice.total_amount -= target_detail.amount
    db.delete(target_detail)

    sync_invoice_status(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice



# 5. QUERY ALL INVOICES (WITH ADVANCED ACCOUNTING FILTERS)
@router.get("/invoices", response_model=list[schemas.InvoiceResponse])
def list_invoices(
    class_id: Optional[UUID] = None,
    status: Optional[str] = None,
    session: Optional[str] = None,
    term: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["admin", "bursar"]))
):
    """
    Enables administrators to query all bills issued by their institution with granular multi-variable sorting.
    """
    query = db.query(models.Invoice).options(
        selectinload(models.Invoice.items),
        joinedload(models.Invoice.student)  # Optimization: Eagerly map student identifiers
    ).filter(models.Invoice.org_id == current_user.org_id)

    if class_id:
        query = query.join(models.Student).filter(models.Student.class_id == class_id)
    if status:
        try:
            # Explicit string-to-Enum parsing to prevent DB serialization exceptions
            enum_status = models.InvoiceStatus(status.lower())
            query = query.filter(models.Invoice.status == enum_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid query filter status value: '{status}'"
            )
    if session:
        query = query.filter(models.Invoice.session == session)
    if term:
        query = query.filter(models.Invoice.term == term)

    return query.all()



# 6. GET SINGLE INVOICE BREAKDOWN
@router.get("/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
def get_single_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """
    Fetches detailed sub-items information of an individual student invoice statement.
    """
    invoice = db.query(models.Invoice).options(
        selectinload(models.Invoice.items),
        joinedload(models.Invoice.student)  # Trace individual student profiles transparently
    ).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.org_id == current_user.org_id  # Security Patch: Multi-tenant tenant boundary guard
    ).first()

    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice record not found")
    return invoice