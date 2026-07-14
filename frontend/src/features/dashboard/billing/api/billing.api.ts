import { apiClient } from "@/src/shared/api-client";
import type {
  FeeTemplate,
  InvoiceDetail,
  InvoiceSummary,
  SchoolClass,
  StudentSummary,
} from "../types/billing.types";

export async function fetchClasses(): Promise<SchoolClass[]> {
  return apiClient.get<SchoolClass[]>("/classes");
}

export async function fetchFeeTemplates(): Promise<FeeTemplate[]> {
  return apiClient.get<FeeTemplate[]>("/billing/templates");
}

export async function fetchFeeTemplate(templateId: string): Promise<FeeTemplate> {
  return apiClient.get<FeeTemplate>(`/billing/templates/${templateId}`);
}

export async function fetchStudents(classId?: string): Promise<StudentSummary[]> {
  const path = classId ? `/students?class_id=${classId}` : "/students";
  return apiClient.get<StudentSummary[]>(path);
}

export async function generateInvoices(payload: {
  class_id: string;
  template_id: string;
  session: string;
  term: string;
  due_date?: string;
  optional_allocations: Array<{
    student_id: string;
    selected_line_item_ids: string[];
  }>;
}): Promise<{ message: string; count: number }> {
  return apiClient.post<{ message: string; count: number }>("/billing/generate", payload);
}

export async function fetchInvoices(filters: {
  class_id?: string;
  status?: string;
  session?: string;
  term?: string;
} = {}): Promise<InvoiceSummary[]> {
  const params = new URLSearchParams();

  if (filters.class_id) params.set("class_id", filters.class_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.session) params.set("session", filters.session);
  if (filters.term) params.set("term", filters.term);

  const query = params.toString();
  return apiClient.get<InvoiceSummary[]>(query ? `/billing/invoices?${query}` : "/billing/invoices");
}

export async function fetchInvoice(invoiceId: string): Promise<InvoiceDetail> {
  return apiClient.get<InvoiceDetail>(`/billing/invoices/${invoiceId}`);
}

export async function addInvoiceItem(invoiceId: string, feeLineItemId: string): Promise<InvoiceDetail> {
  return apiClient.post<InvoiceDetail>(`/billing/invoices/${invoiceId}/items`, {
    fee_line_item_id: feeLineItemId,
  });
}

export async function removeInvoiceItem(invoiceId: string, itemId: string): Promise<InvoiceDetail> {
  return apiClient.delete<InvoiceDetail>(`/billing/invoices/${invoiceId}/items/${itemId}`);
}

export async function voidInvoice(invoiceId: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>(`/billing/invoices/${invoiceId}/void`);
}

export async function verifyInvoicePayment(invoiceId: string, transactionReference?: string): Promise<InvoiceDetail> {
  return apiClient.post<InvoiceDetail>(`/billing/invoices/${invoiceId}/verify-payment`, transactionReference
    ? { transaction_reference: transactionReference }
    : undefined);
}

export async function reverseInvoiceTransaction(invoiceId: string, transactionId: string): Promise<InvoiceDetail> {
  return apiClient.post<InvoiceDetail>(`/billing/invoices/${invoiceId}/transactions/${transactionId}/reverse`);
}

export async function voidClassInvoices(
  classId: string,
  session: string,
  term: string,
): Promise<{ message: string }> {
  const params = new URLSearchParams({ session, term });
  return apiClient.post<{ message: string }>(`/billing/classes/${classId}/void?${params.toString()}`);
}
