"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, PlusCircle, Trash2, XCircle } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { addInvoiceItem, fetchFeeTemplates, removeInvoiceItem, voidInvoice } from "@/src/features/dashboard/billing/api/billing.api";
import { useInvoiceDetail } from "@/src/features/dashboard/billing/hooks/billing.hooks";
import type { FeeTemplate } from "@/src/features/dashboard/billing/types/billing.types";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

function formatCurrency(value: number | string | undefined | null) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numeric);
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;
  const { invoice, isLoading, error, load } = useInvoiceDetail(invoiceId);
  const [templates, setTemplates] = useState<FeeTemplate[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await fetchFeeTemplates();
        setTemplates(data);
      } catch {
        setTemplates([]);
      }
    }

    void loadTemplates();
  }, []);

  const availableOptionalItems = useMemo(() => {
    if (!invoice) return [];
    const existingNames = new Set((invoice.items ?? []).map((item) => item.name));
    return templates.flatMap((template) =>
      template.line_items.filter((lineItem) => !lineItem.is_compulsory && !existingNames.has(lineItem.name)),
    );
  }, [invoice, templates]);

  const runningTotal = useMemo(() => {
    if (!invoice) return 0;
    return (invoice.items ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  }, [invoice]);

  async function handleAddItem() {
    if (!invoiceId || !selectedItemId) return;
    setIsMutating(true);
    setActionError(null);
    try {
      await addInvoiceItem(invoiceId, selectedItemId);
      setSelectedItemId("");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not add that optional fee.");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!invoiceId) return;
    setIsMutating(true);
    setActionError(null);
    try {
      await removeInvoiceItem(invoiceId, itemId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not remove that line item.");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleVoid() {
    if (!invoiceId || !window.confirm("Void this invoice?")) return;
    setIsMutating(true);
    setActionError(null);
    try {
      await voidInvoice(invoiceId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not void this invoice.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <DashboardPageShell>
      <DashboardHero
        eyebrow="Billing"
        title="Invoice details"
        description="Review the invoice breakdown, add optional charges, or void the statement."
        action={(
          <Link href="/dashboard/billing" className="text-sm font-medium text-primary underline underline-offset-4">
            Back to invoices
          </Link>
        )}
      />

      {isLoading ? (
        <DashboardPanel>
          <div className="text-sm text-on-surface-variant">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Loading invoice…
          </div>
        </DashboardPanel>
      ) : error ? (
        <DashboardPanel className="border-error/20 bg-error/10">
          <div className="text-sm text-error">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        </DashboardPanel>
      ) : invoice ? (
        <>
          <DashboardPanel>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface-variant">Invoice #{invoice.id.slice(0, 8)}</p>
                <h2 className="mt-2 font-headline text-2xl text-on-surface">
                  {invoice.student?.first_name} {invoice.student?.last_name}
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">{invoice.session} · {invoice.term}</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {invoice.student?.school_class?.name ?? "Unassigned class"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface-container-low px-4 py-3">
                <p className="text-sm text-on-surface-variant">Current total</p>
                <p className="mt-1 font-headline text-2xl text-on-surface">{formatCurrency(runningTotal)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-surface-container-low p-4">
                <p className="text-sm text-on-surface-variant">Status</p>
                <p className="mt-2 font-semibold text-on-surface">{invoice.status}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface-container-low p-4">
                <p className="text-sm text-on-surface-variant">Due date</p>
                <p className="mt-2 font-semibold text-on-surface">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-NG") : "—"}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface-container-low p-4">
                <p className="text-sm text-on-surface-variant">Paid amount</p>
                <p className="mt-2 font-semibold text-on-surface">{formatCurrency(invoice.paid_amount)}</p>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="font-headline text-xl text-on-surface">Line items</h3>
                <p className="mt-1 text-sm text-on-surface-variant">Add optional charges or remove them before the invoice is settled.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedItemId}
                  onChange={(event) => setSelectedItemId(event.target.value)}
                  className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                >
                  <option value="">Select optional fee</option>
                  {availableOptionalItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <Button onClick={() => void handleAddItem()} disabled={isMutating || !selectedItemId}>
                  <PlusCircle className="h-4 w-4" />
                  Add fee
                </Button>
                <Button variant="secondary" onClick={() => void handleVoid()} disabled={isMutating || invoice.status === "voided"}>
                  <XCircle className="h-4 w-4" />
                  Void invoice
                </Button>
              </div>
            </div>

            {actionError ? (
              <div className="mt-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                {actionError}
              </div>
            ) : null}

            <div className="mt-6 overflow-hidden rounded-xl border border-border/70">
              <div className="grid grid-cols-[1.6fr_0.8fr_0.3fr] bg-surface-container-low px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                <span>Name</span>
                <span>Amount</span>
                <span>Action</span>
              </div>
              <div className="divide-y divide-border/70 bg-white">
                {(invoice.items ?? []).map((item) => (
                  <div key={item.id} className="grid grid-cols-[1.6fr_0.8fr_0.3fr] items-center px-4 py-4">
                    <div>
                      <p className="font-semibold text-on-surface">{item.name}</p>
                      <p className="text-sm text-on-surface-variant">{item.id.slice(0, 8)}</p>
                    </div>
                    <div className="text-sm font-semibold text-on-surface">{formatCurrency(item.amount)}</div>
                    <button onClick={() => void handleRemoveItem(item.id)} className="flex items-center justify-center text-error">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </DashboardPanel>
        </>
      ) : null}
    </DashboardPageShell>
  );
}
