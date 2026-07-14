"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Filter, Loader2, PlusCircle, Search } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useInvoiceActions, useInvoiceList } from "@/src/features/dashboard/billing/hooks/billing.hooks";
import { fetchClasses } from "@/src/features/dashboard/billing/api/billing.api";
import type { SchoolClass } from "@/src/features/dashboard/billing/types/billing.types";
import { DashboardEmptyState, DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

function formatCurrency(value: number | string | undefined | null) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BillingListPage() {
  const { invoices, isLoading, error, load } = useInvoiceList();
  const { voidClass, isLoading: isVoiding, error: voidError } = useInvoiceActions();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadClasses() {
      try {
        const data = await fetchClasses();
        if (active) setClasses(data);
      } catch {
        if (active) setClasses([]);
      }
    }

    void loadClasses();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void load({
      class_id: classFilter || undefined,
      status: statusFilter || undefined,
      session: sessionFilter || undefined,
      term: termFilter || undefined,
    });
  }, [classFilter, statusFilter, sessionFilter, termFilter, load]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classFilter),
    [classes, classFilter],
  );

  const filteredInvoices = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return invoices;

    return invoices.filter((invoice) => {
      const studentName = [invoice.student?.first_name, invoice.student?.last_name].filter(Boolean).join(" ").toLowerCase();
      const className = invoice.student?.school_class?.name?.toLowerCase() ?? "";
      const sileteId = invoice.student?.silete_id?.toLowerCase() ?? "";
      const session = invoice.session.toLowerCase();
      const term = invoice.term.toLowerCase();

      return (
        studentName.includes(query)
        || className.includes(query)
        || sileteId.includes(query)
        || session.includes(query)
        || term.includes(query)
      );
    });
  }, [invoices, searchTerm]);

  async function handleBulkVoid() {
    if (!selectedClass || !sessionFilter || !termFilter) {
      setFeedback("Select a class, session, and term before voiding invoices.");
      return;
    }

    try {
      const result = await voidClass(selectedClass.id, sessionFilter, termFilter);
      setFeedback(result.message);
      await load({
        class_id: classFilter || undefined,
        status: statusFilter || undefined,
        session: sessionFilter || undefined,
        term: termFilter || undefined,
      });
    } catch {
      setFeedback(voidError ?? "We could not void that class batch.");
    }
  }

  return (
    <DashboardPageShell>
      <DashboardHero
        eyebrow="Billing"
        title="Invoice workspace"
        description="Generate invoices for your classes and manage current balances from one place."
        action={(
          <Button href="/dashboard/billing/generate" size="sm" className="whitespace-nowrap">
            <PlusCircle className="h-4 w-4" />
            Generate invoices
          </Button>
        )}
      />

      <DashboardPanel>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <label className="space-y-2 text-sm text-on-surface-variant lg:col-span-1">
            <span className="block font-medium">Search invoice</span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <Search className="h-4 w-4 shrink-0 text-on-surface-variant" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60"
                placeholder="Student name, Sileti ID, class, session"
              />
            </div>
          </label>
          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium">Class</span>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">All classes</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium">Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">All statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="voided">Voided</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium">Session</span>
            <input value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="2024/2025" />
          </label>
          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium">Term</span>
            <select value={termFilter} onChange={(event) => setTermFilter(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">Any term</option>
              <option value="First Term">First Term</option>
              <option value="Second Term">Second Term</option>
              <option value="Third Term">Third Term</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface-container-low/60 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <Filter className="h-4 w-4" />
            <span>
              {searchTerm || classFilter || statusFilter || sessionFilter || termFilter
                ? `Showing ${filteredInvoices.length} of ${invoices.length} invoices`
                : `Showing all ${invoices.length} invoices`}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={handleBulkVoid} disabled={isVoiding || !selectedClass || !sessionFilter || !termFilter}>
            {isVoiding ? "Voiding…" : "Void invoices for this class"}
          </Button>
        </div>

        {feedback && <div className="mt-4 rounded-[1.15rem] border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-primary">{feedback}</div>}
        {voidError && <p className="mt-3 text-xs text-error">{voidError}</p>}
      </DashboardPanel>

      <DashboardPanel>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-lg border border-border/70 bg-surface-container-low" />)}
          </div>
        ) : error ? (
          <div className="rounded-[1.25rem] border border-error/20 bg-error/10 px-4 py-3 text-xs text-error">{error}</div>
        ) : filteredInvoices.length === 0 ? (
          <DashboardEmptyState
            title="No invoices found"
            description={
              searchTerm
                ? "No invoice matches that search. Try a student name, Sileti ID, class, or session."
                : "No invoices match those filters yet. Generate a batch to populate this list."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-[1.4rem] border border-border/70 bg-white shadow-sm">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.7fr_1fr] bg-surface-container-low px-4 py-3 text-[11px] font-label uppercase tracking-[0.35em] text-on-surface-variant">
                <span>Student</span>
                <span>Class</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Due</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-border/70 bg-white">
                {filteredInvoices.map((invoice) => {
                  return (
                    <div key={invoice.id} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.7fr_1fr] items-center px-4 py-4 transition-colors hover:bg-surface-container-low/70">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-on-surface">
                          {invoice.student?.first_name && invoice.student?.last_name
                            ? `${invoice.student.first_name} ${invoice.student.last_name}`
                            : invoice.student?.silete_id ?? "Unknown student"}
                        </p>
                        <p className="truncate text-xs text-on-surface-variant">{invoice.session} · {invoice.term}</p>
                      </div>
                      <div className="min-w-0 text-sm text-on-surface-variant">
                        <p className="truncate font-medium text-on-surface">
                          {invoice.student?.school_class?.name ?? "Unassigned class"}
                        </p>
                        {invoice.student?.school_class?.level ? (
                          <p className="text-xs text-on-surface-variant">Level {invoice.student.school_class.level}</p>
                        ) : null}
                      </div>
                      <div className="text-sm font-semibold text-on-surface">{formatCurrency(invoice.total_amount)}</div>
                      <div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${invoice.status === "paid" ? "border-green-200 bg-green-50 text-green-700" : invoice.status === "voided" ? "border-border bg-surface-container-low text-on-surface-variant" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="text-sm text-on-surface-variant">{formatDate(invoice.due_date)}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/billing/invoices/${invoice.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md"
                        >
                          View details
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DashboardPanel>
    </DashboardPageShell>
  );
}
