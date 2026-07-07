"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { addInvoiceItem, fetchFeeTemplates, removeInvoiceItem, reverseInvoiceTransaction, verifyInvoicePayment, voidInvoice } from "@/src/features/dashboard/billing/api/billing.api";
import { useInvoiceDetail } from "@/src/features/dashboard/billing/hooks/billing.hooks";
import type { FeeTemplate, InvoiceTransaction } from "@/src/features/dashboard/billing/types/billing.types";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

function formatCurrency(value: number | string | undefined | null) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatShortDateTime(value?: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// Converts raw backend enum-style strings (e.g. "un_paid", "bank_transfer")
// into display-ready text ("Un Paid", "Bank Transfer"). CSS `capitalize`
// alone won't do this — it capitalizes per-word but leaves underscores intact.
function humanize(value?: string | null): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function statusTone(status?: string | null) {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "SUCCESS" || normalized === "PAID") return "border-green-200 bg-green-50 text-green-700";
  if (normalized === "FAILED") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "REVERSED" || normalized === "VOIDED") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can fail silently (permissions/insecure context); no need to surface an error for a convenience action.
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void handleCopy();
      }}
      className="inline-flex items-center gap-1 rounded-md border border-transparent p-1 text-on-surface-variant transition-colors hover:border-border hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;
  const { invoice, isLoading, error, load } = useInvoiceDetail(invoiceId);
  const [templates, setTemplates] = useState<FeeTemplate[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Per-action loading state, scoped to the specific row/transaction it belongs to.
  // No shared "isMutating" flag — one card's recheck spinner never disables a
  // completely unrelated card's reverse button.
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [verifyingReference, setVerifyingReference] = useState<string | null>(null);
  const [reversingTransactionId, setReversingTransactionId] = useState<string | null>(null);
  const [confirmingVoid, setConfirmingVoid] = useState(false);

  const isMutating = isAddingItem || Boolean(removingItemId) || isVoiding || Boolean(verifyingReference) || Boolean(reversingTransactionId);

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

  useEffect(() => {
    if (!actionSuccess) return;
    const timeout = window.setTimeout(() => setActionSuccess(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [actionSuccess]);

  useEffect(() => {
    setConfirmingVoid(false);
  }, [invoiceId]);

  const availableOptionalItems = useMemo(() => {
    if (!invoice) return [];
    const existingNames = new Set((invoice.items ?? []).map((item) => item.name));
    const matchingTemplate = invoice.template_id
      ? templates.find((template) => template.id === invoice.template_id) ?? null
      : null;
    const sourceTemplates = matchingTemplate ? [matchingTemplate] : templates;
    const optionalItems = sourceTemplates.flatMap((template) =>
      template.line_items.filter((lineItem) => !lineItem.is_compulsory && !existingNames.has(lineItem.name)),
    );
    const seen = new Set<string>();
    return optionalItems.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [invoice, templates]);

  const runningTotal = useMemo(() => {
    if (!invoice) return 0;
    return (invoice.items ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  }, [invoice]);

  async function handleAddItem() {
    if (!invoiceId || !selectedItemId) return;
    setIsAddingItem(true);
    setActionError(null);
    try {
      const addedItem = templates
        .flatMap((template) => template.line_items)
        .find((item) => item.id === selectedItemId);
      await addInvoiceItem(invoiceId, selectedItemId);
      setSelectedItemId("");
      await load();
      setActionSuccess(addedItem ? `${addedItem.name} added to the invoice.` : "Fee added to the invoice.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not add that optional fee.");
    } finally {
      setIsAddingItem(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!invoiceId) return;
    setRemovingItemId(itemId);
    setActionError(null);
    try {
      await removeInvoiceItem(invoiceId, itemId);
      await load();
      setActionSuccess("Line item removed.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not remove that line item.");
    } finally {
      setRemovingItemId(null);
    }
  }

  async function handleVoid() {
    if (!invoiceId) return;
    if (!confirmingVoid) {
      setConfirmingVoid(true);
      return;
    }
    setIsVoiding(true);
    setActionError(null);
    try {
      await voidInvoice(invoiceId);
      await load();
      setActionSuccess("Invoice voided.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not void this invoice.");
    } finally {
      setIsVoiding(false);
      setConfirmingVoid(false);
    }
  }

  async function handleReverseTransaction(transactionId: string) {
    if (!invoiceId) return;
    setReversingTransactionId(transactionId);
    setActionError(null);
    try {
      await reverseInvoiceTransaction(invoiceId, transactionId);
      await load();
      setActionSuccess("Transaction marked as refunded.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not reverse that transaction right now.");
    } finally {
      setReversingTransactionId(null);
    }
  }

  async function handleManualVerify(reference: string) {
    if (!invoiceId || !reference) return;
    setVerifyingReference(reference);
    setActionError(null);
    try {
      await verifyInvoicePayment(invoiceId, reference);
      await load();
      setActionSuccess(`Payment status rechecked for ${reference}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not recheck this payment right now.");
    } finally {
      setVerifyingReference(null);
    }
  }

  return (
    <DashboardPageShell>
      <DashboardHero
        eyebrow="Billing"
        title="Invoice details"
        description="Review the invoice breakdown, add optional charges, or void the statement."
        action={(
          <Link
            href="/dashboard/billing"
            className="text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Back to invoices
          </Link>
        )}
      />

      {actionSuccess ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-[1.35rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {actionSuccess}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-6">
          <DashboardPanel>
            <div className="h-24 animate-pulse rounded-xl bg-surface-container-low" />
          </DashboardPanel>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <DashboardPanel>
              <div className="h-64 animate-pulse rounded-xl bg-surface-container-low" />
            </DashboardPanel>
            <DashboardPanel>
              <div className="h-64 animate-pulse rounded-xl bg-surface-container-low" />
            </DashboardPanel>
          </div>
        </div>
      ) : error ? (
        <DashboardPanel className="border-error/20 bg-error/10">
          <div className="flex items-start gap-2 text-sm text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        </DashboardPanel>
      ) : invoice ? (
        <>
          <DashboardPanel className="relative overflow-hidden border-2">
            {invoice.status === "voided" ? (
              <span
                aria-hidden
                className="pointer-events-none absolute right-6 top-6 select-none rounded-md border-4 border-error/50 px-4 py-1 font-label text-lg font-bold uppercase tracking-[0.3em] text-error/50"
                style={{ transform: "rotate(-10deg)" }}
              >
                Void
              </span>
            ) : null}

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-label text-sm font-medium text-on-surface-variant">Invoice #{invoice.id.slice(0, 8)}</p>
                  <CopyButton value={invoice.id} label="invoice ID" />
                </div>
                <h2 className="mt-2 font-headline text-2xl text-on-surface">
                  {invoice.student?.first_name} {invoice.student?.last_name}
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">{invoice.session} · {invoice.term}</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {invoice.student?.school_class?.name ?? "Unassigned class"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface-container-low px-4 py-3 text-right">
                <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">Current total</p>
                <p className="mt-1 font-headline text-2xl tabular-nums text-on-surface">{formatCurrency(runningTotal)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-surface-container-low p-4">
                <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">Status</p>
                <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(invoice.status)}`}>
                  {humanize(invoice.status)}
                </span>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface-container-low p-4">
                <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">Due date</p>
                <p className="mt-2 font-semibold tabular-nums text-on-surface">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-NG") : "—"}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface-container-low p-4">
                <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">Paid amount</p>
                <p className="mt-2 font-semibold tabular-nums text-on-surface">{formatCurrency(invoice.paid_amount)}</p>
              </div>
            </div>
          </DashboardPanel>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <DashboardPanel>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <h3 className="font-headline text-xl text-on-surface">Checkout attempts</h3>
                {invoice.transactions?.length ? (
                  <div className="font-label rounded-full border border-border bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    {invoice.transactions.length} attempt{invoice.transactions.length === 1 ? "" : "s"} recorded
                  </div>
                ) : null}
              </div>

              {invoice.transactions?.length ? (
                <div className="mt-4 grid gap-3">
                  {invoice.transactions.map((transaction) => {
                    const status = transaction.status.toUpperCase();
                    const isReversing = reversingTransactionId === transaction.id;
                    const isVerifying = verifyingReference === transaction.reference;
                    // Recheck only makes sense while the outcome is still uncertain.
                    const showRecheck = status === "PENDING" || status === "FAILED";
                    // Reversing only makes sense once money has actually moved or is held.
                    const showReverse = status === "SUCCESS" || status === "PENDING";
                    const needsAttention = showRecheck;

                    return (
                      <div
                        key={transaction.id}
                        className="flex w-full flex-col gap-3 rounded-2xl border border-border/70 bg-white p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-semibold text-on-surface">{transaction.reference}</p>
                              <CopyButton value={transaction.reference} label="reference" />
                              <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(transaction.status)}`}>
                                {humanize(transaction.status)}
                              </span>
                              {needsAttention ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                                  Needs attention
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-on-surface-variant">
                              Created {formatShortDateTime(transaction.created_at)}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-on-surface-variant">
                            <div className="text-right">
                              <p className="font-label text-xs uppercase tracking-[0.2em]">Amount</p>
                              <p className="font-semibold tabular-nums text-on-surface">{formatCurrency(transaction.amount)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-label text-xs uppercase tracking-[0.2em]">Method</p>
                              <p className="font-semibold text-on-surface">{humanize(transaction.payment_method)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border/70 pt-3 text-sm text-on-surface-variant">
                          <span className="text-xs">
                            {transaction.checkout_url ? "Checkout link issued" : "No checkout link stored"}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {showRecheck ? (
                              <button
                                type="button"
                                onClick={() => void handleManualVerify(transaction.reference)}
                                disabled={isVerifying}
                                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                title="Verify this specific checkout attempt against Paystack."
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? "animate-spin" : ""}`} />
                                {isVerifying ? "Rechecking…" : "Recheck payment"}
                              </button>
                            ) : null}
                            {showReverse ? (
                              <button
                                type="button"
                                onClick={() => void handleReverseTransaction(transaction.id)}
                                disabled={isReversing || isVerifying}
                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                title="Mark this attempt as reversed/refunded so it is no longer treated as active."
                              >
                                <RotateCcw className={`h-3.5 w-3.5 ${isReversing ? "animate-spin" : ""}`} />
                                {isReversing ? "Reversing…" : "Mark refunded"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-white px-4 py-5 text-sm text-on-surface-variant">
                  No transaction attempts have been recorded for this invoice yet.
                </div>
              )}
            </DashboardPanel>

            <DashboardPanel>
              <div className="flex flex-col gap-4">
                <h3 className="font-headline text-xl text-on-surface">Line items</h3>

                <div className="rounded-2xl border border-border/70 bg-surface-container-low/60 p-4">
                  <div className="flex flex-col gap-3">
                    <label className="space-y-2">
                      <span className="block font-label text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Optional fee</span>
                      <select
                        value={selectedItemId}
                        onChange={(event) => setSelectedItemId(event.target.value)}
                        disabled={availableOptionalItems.length === 0}
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">
                          {availableOptionalItems.length === 0 ? "No optional fees available" : "Select optional fee"}
                        </option>
                        {availableOptionalItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {formatCurrency(item.amount)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => void handleAddItem()} disabled={isAddingItem || !selectedItemId}>
                        {isAddingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                        {isAddingItem ? "Adding…" : "Add fee"}
                      </Button>

                      {invoice.status !== "voided" ? (
                        confirmingVoid ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => void handleVoid()}
                              disabled={isVoiding}
                              className="border-error/30 bg-error/10 text-error hover:bg-error/20"
                            >
                              {isVoiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                              {isVoiding ? "Voiding…" : "Confirm void"}
                            </Button>
                            <button
                              type="button"
                              onClick={() => setConfirmingVoid(false)}
                              disabled={isVoiding}
                              className="text-sm font-medium text-on-surface-variant underline underline-offset-4 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <Button variant="secondary" onClick={() => void handleVoid()} disabled={isMutating}>
                            <XCircle className="h-4 w-4" />
                            Void invoice
                          </Button>
                        )
                      ) : null}
                    </div>
                  </div>
                </div>

                {actionError ? (
                  <div className="flex items-start gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {actionError}
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
                  <div className="hidden grid-cols-[1.6fr_0.8fr_0.3fr] bg-surface-container-low px-4 py-3 font-label text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant sm:grid">
                    <span>Name</span>
                    <span>Amount</span>
                    <span>Action</span>
                  </div>
                  <div className="divide-y divide-border/70">
                    {(invoice.items ?? []).map((item) => {
                      const isRemoving = removingItemId === item.id;
                      return (
                        <div key={item.id} className="flex flex-col gap-2 px-4 py-4 sm:grid sm:grid-cols-[1.6fr_0.8fr_0.3fr] sm:items-center sm:gap-0">
                          <div>
                            <p className="font-semibold text-on-surface">{item.name}</p>
                            <p className="font-label text-sm text-on-surface-variant">{item.id.slice(0, 8)}</p>
                          </div>
                          <div className="text-sm font-semibold tabular-nums text-on-surface">{formatCurrency(item.amount)}</div>
                          <button
                            onClick={() => void handleRemoveItem(item.id)}
                            disabled={isRemoving}
                            aria-label={`Remove ${item.name}`}
                            title={`Remove ${item.name}`}
                            className="flex w-fit items-center justify-center rounded-md p-1.5 text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error sm:justify-self-start"
                          >
                            {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      );
                    })}
                    {(invoice.items ?? []).length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-on-surface-variant">No line items on this invoice yet.</div>
                    ) : null}
                  </div>
                  {(invoice.items ?? []).length > 0 ? (
                    <div className="flex items-center justify-between border-t border-dashed border-border/70 bg-surface-container-low/60 px-4 py-3">
                      <span className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">Total</span>
                      <span className="font-headline text-lg tabular-nums text-on-surface">{formatCurrency(runningTotal)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </DashboardPanel>
          </div>
        </>
      ) : null}
    </DashboardPageShell>
  );
}