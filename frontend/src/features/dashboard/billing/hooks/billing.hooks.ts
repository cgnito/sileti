import { useCallback, useState } from "react";
import { ApiError } from "@/src/shared/api-error";
import {
  addInvoiceItem,
  fetchClasses,
  fetchFeeTemplate,
  fetchFeeTemplates,
  fetchInvoice,
  fetchInvoices,
  fetchStudents,
  generateInvoices,
  removeInvoiceItem,
  voidClassInvoices,
  voidInvoice,
} from "../api/billing.api";
import type {
  FeeTemplate,
  InvoiceDetail,
  InvoiceSummary,
  SchoolClass,
  StudentSummary,
} from "../types/billing.types";

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, "Something went wrong.");
}

export function useBillingData() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [templates, setTemplates] = useState<FeeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [classData, templateData] = await Promise.all([fetchClasses(), fetchFeeTemplates()]);
      setClasses(classData);
      setTemplates(templateData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load the billing form.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { classes, templates, isLoading, error, load };
}

export function useInvoiceList() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (filters: {
    class_id?: string;
    status?: string;
    session?: string;
    term?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchInvoices(filters);
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load invoices.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { invoices, isLoading, error, load };
}

export function useInvoiceDetail(invoiceId?: string) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchInvoice(invoiceId);
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load the invoice.");
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  return { invoice, isLoading, error, load };
}

export function useGenerateBilling() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (payload: {
    class_id: string;
    template_id: string;
    session: string;
    term: string;
    due_date?: string;
    optional_allocations: Array<{
      student_id: string;
      selected_line_item_ids: string[];
    }>;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      return await generateInvoices(payload);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { run, isLoading, error };
}

export function useInvoiceActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = useCallback(async (invoiceId: string, feeLineItemId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await addInvoiceItem(invoiceId, feeLineItemId);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeItem = useCallback(async (invoiceId: string, itemId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await removeInvoiceItem(invoiceId, itemId);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const voidSingle = useCallback(async (invoiceId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await voidInvoice(invoiceId);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const voidClass = useCallback(async (classId: string, session: string, term: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await voidClassInvoices(classId, session, term);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { addItem, removeItem, voidSingle, voidClass, isLoading, error };
}

export async function loadStudentsForClass(classId: string): Promise<StudentSummary[]> {
  return fetchStudents(classId);
}

export async function loadFeeTemplate(templateId: string): Promise<FeeTemplate> {
  return fetchFeeTemplate(templateId);
}
