export interface SchoolClass {
  id: string;
  name: string;
  level: number;
  org_id: string;
}

export interface FeeLineItem {
  id: string;
  name: string;
  amount: number | string;
  is_compulsory: boolean;
}

export interface FeeTemplate {
  id: string;
  name: string;
  description?: string | null;
  line_items: FeeLineItem[];
}

export interface StudentSummary {
  id: string;
  first_name: string;
  last_name: string;
  class_id?: string | null;
  silete_id?: string | null;
  status?: string | null;
  date_of_birth?: string | null;
  school_class?: SchoolClass | null;
}

export interface InvoiceLineItem {
  id: string;
  name: string;
  amount: number | string;
}

export interface InvoiceSummary {
  id: string;
  student_id: string;
  session: string;
  term: string;
  total_amount: number | string;
  paid_amount: number | string;
  status: string;
  due_date?: string | null;
  items?: InvoiceLineItem[];
  student?: StudentSummary | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  items: InvoiceLineItem[];
}
