"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, CircleDot, Loader2, PlusCircle, RefreshCw, RotateCcw, Trash2, XCircle } from "lucide-react";
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

function getLatestTransactionReference(transactions?: InvoiceTransaction[] | null) {
  if (!transactions?.length) return null;

  return [...transactions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((transaction) => transaction.reference)
    .find(Boolean) ?? null;
}

function formatShortDateTime(value?: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;
  const { invoice, isLoading, error, load } = useInvoiceDetail(invoiceId);
  const [templates, setTemplates] = useState<FeeTemplate[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedTransactionReference, setSelectedTransactionReference] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [reversingTransactionId, setReversingTransactionId] = useState<string | null>(null);

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

  const latestTransactionReference = useMemo(
    () => getLatestTransactionReference(invoice?.transactions),
    [invoice?.transactions],
  );

  useEffect(() => {
    const transactions = invoice?.transactions ?? [];
    if (!transactions.length) {
      setSelectedTransactionReference("");
      return;
    }

    const preferred =
      transactions.find((transaction) => transaction.status?.toUpperCase() === "PENDING")?.reference
      ?? transactions.find((transaction) => transaction.status?.toUpperCase() === "FAILED")?.reference
      ?? transactions.find((transaction) => transaction.status?.toUpperCase() === "SUCCESS")?.reference
      ?? latestTransactionReference
      ?? transactions[0]?.reference
      ?? "";

    setSelectedTransactionReference(preferred);
  }, [invoice?.transactions, latestTransactionReference]);

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

  async function handleReverseTransaction(transactionId: string) {
    if (!invoiceId) return;
    setReversingTransactionId(transactionId);
    setActionError(null);
    try {
      await reverseInvoiceTransaction(invoiceId, transactionId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not reverse that transaction right now.");
    } finally {
      setReversingTransactionId(null);
    }
  }

  async function handleManualVerify() {
    const targetReference = selectedTransactionReference || latestTransactionReference;
    if (!invoiceId || !targetReference) return;
    setIsMutating(true);
    setActionError(null);
    try {
      await verifyInvoicePayment(invoiceId, targetReference);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We could not recheck this payment right now.");
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleManualVerify()}
              disabled={isMutating || invoice?.status === "paid" || !selectedTransactionReference}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              title={selectedTransactionReference ? "Verify the selected checkout attempt for this invoice." : "No transaction reference is available to verify yet."}
            >
              <RefreshCw className="h-4 w-4" />
              Recheck payment
            </button>
            <Link href="/dashboard/billing" className="text-sm font-medium text-primary underline underline-offset-4">
              Back to invoices
            </Link>
          </div>
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
                <p className="mt-1 text-sm text-on-surface-variant">
                  Add optional charges from the invoice template before the bill is settled.
                </p>
                <p className="mt-2 text-xs text-on-surface-variant">
                  If the webhook did not settle this invoice yet, you can use the optional payment recheck above. It will use the recorded checkout reference when available, or the invoice's stored transaction record otherwise.
                </p>
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

            <div className="mt-6 rounded-xl border border-border/70 bg-surface-container-low/50 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="font-semibold text-on-surface">Checkout attempts</h4>
                  <p className="text-sm text-on-surface-variant">
                    Pick the exact transaction you want to verify. This avoids guessing when an invoice has multiple attempts.
                  </p>
                </div>
                {invoice.transactions?.length ? (
                  <div className="text-xs font-medium text-on-surface-variant">
                    {invoice.transactions.length} attempt{invoice.transactions.length === 1 ? "" : "s"} recorded
                  </div>
                ) : null}
              </div>

              {invoice.transactions?.length ? (
                <div className="mt-4 grid gap-3">
                  {invoice.transactions.map((transaction) => {
                    const status = transaction.status.toUpperCase();
                    const isSelected = selectedTransactionReference === transaction.reference;
                    const isReversing = reversingTransactionId === transaction.id;
                    const statusTone =
                      status === "SUCCESS"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : status === "FAILED"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-amber-200 bg-amber-50 text-amber-700";

                    return (
                      <button
                        key={transaction.id}
                        type="button"
                        onClick={() => setSelectedTransactionReference(transaction.reference)}
                        className={`flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border/70 bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-on-surface">{transaction.reference}</p>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone}`}>
                                {transaction.status}
                              </span>
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Selected
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-on-surface-variant">
                              Created {formatShortDateTime(transaction.created_at)}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                            <div className="text-right">
                              <p className="text-xs uppercase tracking-[0.2em]">Amount</p>
                              <p className="font-semibold text-on-surface">{formatCurrency(transaction.amount)}</p>
                            </div>
                            <CircleDot className="h-4 w-4 text-on-surface-variant" />
                            <div className="text-right">
                              <p className="text-xs uppercase tracking-[0.2em]">Method</p>
                              <p className="font-semibold text-on-surface">{transaction.payment_method ?? "—"}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-on-surface-variant">
                          <span>Reference used for manual verification and webhook reconciliation.</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-on-surface">
                              {transaction.checkout_url ? "Checkout link issued" : "No checkout link stored"}
                            </span>
                            {status !== "REVERSED" && !isSelected ? (
                              <button
                                type="button"
                                onClick={() => void handleReverseTransaction(transaction.id)}
                                disabled={isReversing || isMutating}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
                                title="Mark this extra attempt as reversed/refunded so it is no longer treated as pending."
                              >
                                <RotateCcw className={`h-3.5 w-3.5 ${isReversing ? "animate-spin" : ""}`} />
                                {isReversing ? "Reversing…" : "Mark refunded"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-white px-4 py-5 text-sm text-on-surface-variant">
                  No transaction attempts have been recorded for this invoice yet.
                </div>
              )}
            </div>

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
