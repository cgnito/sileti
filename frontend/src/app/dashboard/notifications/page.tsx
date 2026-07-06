"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Loader2, RefreshCw, Search, Send, TriangleAlert } from "lucide-react";
import { apiClient } from "@/src/shared/api-client";
import { Button } from "@/src/components/shared/Button";
import { DashboardEmptyState, DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

type NotificationInvoice = {
  id: string;
  session: string;
  term: string;
  total_amount: string | number;
  paid_amount: string | number;
  status: string;
};

type NotificationLog = {
  id: string;
  idempotency_key: string;
  org_id: string;
  student_id: string | null;
  invoice_id: string | null;
  channel: string;
  event_type: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  message_sid: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  student_name: string | null;
  class_name: string | null;
  invoice: NotificationInvoice | null;
};

type NotificationListResponse = {
  items: NotificationLog[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
  };
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(value: string | number) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function statusClasses(status: string) {
  switch (status) {
    case "sent":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "skipped":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [summary, setSummary] = useState<NotificationListResponse["summary"]>({ total: 0, sent: 0, failed: 0, skipped: 0 });

  async function loadNotifications(nextPage = page) {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const offset = (nextPage - 1) * limit;

      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (query.trim()) params.set("query", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (eventFilter) params.set("event_type", eventFilter);
      if (channelFilter) params.set("channel", channelFilter);

      const data = await apiClient.get<NotificationListResponse>(`/orgs/notifications?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load notification history.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, [page, query, statusFilter, eventFilter, channelFilter]);

  const currentRange = useMemo(() => {
    if (!total) return "0 notifications";
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    return `Showing ${start}–${end} of ${total}`;
  }, [limit, page, total]);

  const pageCount = Math.max(1, Math.ceil(total / limit));

  async function handleResend(notificationId: string) {
    setIsResending(notificationId);
    setError(null);
    setFeedback(null);
    try {
      const updated = await apiClient.post<NotificationLog>(`/orgs/notifications/${notificationId}/resend`);
      const recipient = updated.channel === "email"
        ? updated.recipient_email ?? updated.recipient_phone ?? "the recipient"
        : updated.recipient_phone ?? updated.recipient_email ?? "the recipient";
      setFeedback(`Resent ${updated.event_type.replace(/_/g, " ")} to ${recipient}.`);
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not resend that notification.");
    } finally {
      setIsResending(null);
    }
  }

  return (
    <DashboardPageShell>
      <DashboardHero
        eyebrow="Overview"
        title="Notifications"
        description="Track outbound invoice and payment notifications from one audit trail. Parents are first notified by email, then continue the payment flow in WhatsApp."
        action={(
          <Button variant="secondary" size="sm" onClick={() => void loadNotifications()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        )}
      />

      <DashboardPanel className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-[1.15rem] border border-border/70 bg-white px-4 py-4">
            <p className="text-[11px] font-label uppercase tracking-[0.3em] text-on-surface-variant">Total</p>
            <p className="mt-2 text-2xl font-headline text-on-surface">{summary.total}</p>
          </div>
          <div className="rounded-[1.15rem] border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-[11px] font-label uppercase tracking-[0.3em] text-emerald-700">Sent</p>
            <p className="mt-2 text-2xl font-headline text-emerald-800">{summary.sent}</p>
          </div>
          <div className="rounded-[1.15rem] border border-rose-200 bg-rose-50 px-4 py-4">
            <p className="text-[11px] font-label uppercase tracking-[0.3em] text-rose-700">Failed</p>
            <p className="mt-2 text-2xl font-headline text-rose-800">{summary.failed}</p>
          </div>
          <div className="rounded-[1.15rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-label uppercase tracking-[0.3em] text-slate-600">Skipped</p>
            <p className="mt-2 text-2xl font-headline text-slate-700">{summary.skipped}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium text-on-surface">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <input
                  value={query}
                  onChange={(event) => {
                    setPage(1);
                    setQuery(event.target.value);
                  }}
                  placeholder="Search by student, email, phone, class, or SID"
                  className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
          </label>

          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium text-on-surface">Channel</span>
            <select
              value={channelFilter}
              onChange={(event) => {
                setPage(1);
                setChannelFilter(event.target.value);
              }}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All channels</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium text-on-surface">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium text-on-surface">Event</span>
            <select
              value={eventFilter}
              onChange={(event) => {
                setPage(1);
                setEventFilter(event.target.value);
              }}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All events</option>
              <option value="invoice_generated">Invoice generated</option>
              <option value="payment_received">Payment received</option>
            </select>
          </label>
        </div>

        {feedback ? (
          <div className="rounded-[1.15rem] border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-primary">
            {feedback}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] border border-border/70 bg-surface-container-low px-4 py-3">
          <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sent {summary.sent}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
              <TriangleAlert className="h-3.5 w-3.5" />
              Failed {summary.failed}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              <Bell className="h-3.5 w-3.5" />
              Skipped {summary.skipped}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">{currentRange}</p>
        </div>
      </DashboardPanel>

      <DashboardPanel>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg border border-border/70 bg-surface-container-low" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[1.25rem] border border-error/20 bg-error/10 px-4 py-3 text-xs text-error">{error}</div>
        ) : items.length === 0 ? (
          <DashboardEmptyState
            title="No notifications yet"
            description="Once invoices are generated or payments are confirmed, the outbound notification attempts will show up here."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <div className="min-w-[1240px]">
                <div className="grid grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.9fr_1.1fr_0.9fr_0.8fr_0.7fr] bg-surface-container-low px-4 py-3 text-[11px] font-label uppercase tracking-[0.35em] text-on-surface-variant">
                  <span>Recipient</span>
                  <span>Student</span>
                  <span>Class</span>
                  <span>Event</span>
                  <span>Channel</span>
                  <span>Invoice</span>
                  <span>Sent</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>
                <div className="divide-y divide-border/70 bg-white">
                  {items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.9fr_1.1fr_0.9fr_0.8fr_0.7fr] items-center px-4 py-4 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-on-surface">{item.channel === "email" ? (item.recipient_email ?? item.recipient_phone) : item.recipient_phone}</p>
                        <p className="truncate text-xs text-on-surface-variant">{item.recipient_email ?? item.recipient_phone ?? "—"}</p>
                        <p className="truncate text-[11px] text-on-surface-variant">
                          {item.channel === "email"
                            ? "Invoice email with WhatsApp CTA"
                            : "WhatsApp payment follow-up"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        {item.student_id ? (
                          <Link href={`/dashboard/setup/students/${item.student_id}`} className="truncate font-medium text-on-surface transition-colors hover:text-primary">
                            {item.student_name ?? "Student"}
                          </Link>
                        ) : (
                          <p className="truncate font-medium text-on-surface">{item.student_name ?? "Unknown student"}</p>
                        )}
                        <p className="truncate text-xs text-on-surface-variant">{item.idempotency_key}</p>
                      </div>

                      <p className="truncate text-on-surface-variant">{item.class_name ?? "No class"}</p>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-on-surface">{item.event_type.replace(/_/g, " ")}</p>
                        {item.message_sid ? <p className="truncate text-xs text-on-surface-variant font-mono">{item.message_sid}</p> : null}
                      </div>

                      <div className="min-w-0">
                        <span className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold capitalize text-on-surface-variant">
                          {item.channel}
                        </span>
                      </div>

                      <div className="min-w-0">
                        {item.invoice ? (
                          <Link href={`/dashboard/billing/invoices/${item.invoice.id}`} className="truncate font-medium text-on-surface transition-colors hover:text-primary">
                            {item.invoice.session} · {item.invoice.term}
                          </Link>
                        ) : (
                          <p className="truncate text-on-surface-variant">No invoice link</p>
                        )}
                        {item.invoice ? <p className="truncate text-xs text-on-surface-variant">{formatAmount(item.invoice.total_amount)}</p> : null}
                      </div>

                      <p className="text-on-surface-variant">{formatDateTime(item.created_at)}</p>

                      <div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(item.status)}`}>
                          {item.status}
                        </span>
                        {item.error_message ? <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-on-surface-variant">{item.error_message}</p> : null}
                      </div>

                      <div className="flex justify-end">
                        {item.status === "failed" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleResend(item.id)}
                            disabled={isResending === item.id}
                          >
                            {isResending === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Resend
                          </Button>
                        ) : (
                          <span className="text-xs text-on-surface-variant">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-on-surface-variant">{currentRange}</p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  Previous
                </Button>
                <span className="text-xs text-on-surface-variant">
                  Page {page} of {pageCount}
                </span>
                <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </DashboardPanel>
    </DashboardPageShell>
  );
}
