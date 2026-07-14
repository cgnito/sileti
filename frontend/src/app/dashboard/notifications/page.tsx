"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Search, Send } from "lucide-react";
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

// Converts raw backend enum-style strings (e.g. "payment_received", "un_paid")
// into display-ready text ("Payment Received", "Un Paid"). CSS `capitalize`
// alone won't do this — it leaves underscores intact.
function humanize(value?: string | null): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
      setFeedback(`Resent ${humanize(updated.event_type)} to ${recipient}.`);
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.15rem] border border-border/70 bg-white px-4 py-4 shadow-sm shadow-surface-container-low/40">
            <p className="text-[11px] font-label uppercase tracking-[0.3em] text-on-surface-variant">Total</p>
            <p className="mt-2 text-2xl font-headline text-on-surface">{summary.total}</p>
            <p className="mt-1 text-xs text-on-surface-variant">All notification attempts</p>
          </div>
          <div className="rounded-[1.15rem] border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm shadow-emerald-100/40">
            <p className="text-[11px] font-label uppercase tracking-[0.3em] text-emerald-700">Sent</p>
            <p className="mt-2 text-2xl font-headline text-emerald-800">{summary.sent}</p>
            <p className="mt-1 text-xs text-emerald-700/80">Delivered successfully</p>
          </div>
          <div className="rounded-[1.15rem] border border-rose-200 bg-rose-50 px-4 py-4 shadow-sm shadow-rose-100/40">
            <p className="text-[11px] font-label uppercase tracking-[0.3em] text-rose-700">Failed</p>
            <p className="mt-2 text-2xl font-headline text-rose-800">{summary.failed}</p>
            <p className="mt-1 text-xs text-rose-700/80">Can be resent from the table</p>
          </div>
          <div className="rounded-[1.15rem] border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm shadow-slate-100/40">
            <p className="text-[11px] font-label uppercase tracking-[0.3em] text-slate-600">Skipped</p>
            <p className="mt-2 text-2xl font-headline text-slate-700">{summary.skipped}</p>
            <p className="mt-1 text-xs text-slate-600/80">Usually missing recipient data</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr]">
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

        <p className="text-xs text-on-surface-variant">{currentRange}</p>
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
            {/* Horizontal scroll on any viewport where the fixed column widths don't
                fit — most relevant on mobile, but kept unconditional so the table
                never squishes its columns illegibly on a narrow desktop window either. */}
            <div className="overflow-x-auto rounded-[1.25rem] border border-border/70">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[1.2fr_1fr_0.9fr_1fr_0.8fr_0.7fr_0.7fr] gap-4 bg-surface-container-low px-4 py-3 text-[11px] font-label uppercase tracking-[0.32em] text-on-surface-variant">
                  <span>Recipient</span>
                  <span>Student</span>
                  <span>Event</span>
                  <span>Invoice</span>
                  <span>Sent</span>
                  <span>Status</span>
                  <span className="text-right">Action</span>
                </div>
                <div className="divide-y divide-border/70 bg-white">
                  {items.map((item) => {
                    const recipientValue = item.channel === "email" ? (item.recipient_email ?? item.recipient_phone) : item.recipient_phone;

                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1.2fr_1fr_0.9fr_1fr_0.8fr_0.7fr_0.7fr] items-center gap-4 px-4 py-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-on-surface">{recipientValue ?? "—"}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{item.channel === "email" ? "Email" : "WhatsApp"}</p>
                        </div>

                        <div className="min-w-0">
                          {item.student_id ? (
                            <Link href={`/dashboard/setup/students/${item.student_id}`} className="block truncate font-medium text-on-surface transition-colors hover:text-primary">
                              {item.student_name ?? "Student"}
                            </Link>
                          ) : (
                            <p className="truncate font-medium text-on-surface">{item.student_name ?? "Unknown student"}</p>
                          )}
                          <p className="mt-1 truncate text-xs text-on-surface-variant">{item.class_name ?? "No class"}</p>
                        </div>

                        <p className="truncate text-sm text-on-surface">{humanize(item.event_type)}</p>

                        <div className="min-w-0">
                          {item.invoice ? (
                            <Link href={`/dashboard/billing/invoices/${item.invoice.id}`} className="block truncate font-medium text-on-surface transition-colors hover:text-primary">
                              {item.invoice.session} · {item.invoice.term}
                            </Link>
                          ) : (
                            <p className="truncate text-sm text-on-surface-variant">No invoice</p>
                          )}
                          {item.invoice ? <p className="mt-1 truncate text-xs text-on-surface-variant">{formatAmount(item.invoice.total_amount)}</p> : null}
                        </div>

                        <p className="truncate text-sm text-on-surface-variant">{formatDateTime(item.created_at)}</p>

                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(item.status)}`}>
                            {humanize(item.status)}
                          </span>
                          {item.error_message ? (
                            <p className="mt-2 line-clamp-2 break-words text-[11px] leading-5 text-on-surface-variant">{item.error_message}</p>
                          ) : null}
                        </div>

                        <div className="flex justify-end">
                          {item.status === "failed" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void handleResend(item.id)}
                              disabled={isResending === item.id}
                              className="min-w-[96px]"
                            >
                              {isResending === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              Resend
                            </Button>
                          ) : (
                            <span className="text-xs text-on-surface-variant">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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