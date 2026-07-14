"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, PencilLine, Trash2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";
import { DashboardEmptyState, DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

type FeeTemplate = {
  id: string;
  name: string;
  description: string | null;
  line_items: Array<{
    id: string;
    name: string;
    amount: string;
    is_compulsory: boolean;
  }>;
};

export default function FeeTemplateDetailPage() {
  const params = useParams<{ templateId: string }>();
  const router = useRouter();
  const templateId = params.templateId;
  const [template, setTemplate] = useState<FeeTemplate | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTemplate() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<FeeTemplate>(`/billing/templates/${templateId}`);
        if (active) setTemplate(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "We could not load this fee template.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    if (templateId) {
      void loadTemplate();
    }

    return () => {
      active = false;
    };
  }, [templateId]);

  const total = useMemo(
    () => template?.line_items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0) ?? 0,
    [template]
  );
  const compulsoryCount = template?.line_items.filter((item) => item.is_compulsory).length ?? 0;
  const optionalCount = template?.line_items.filter((item) => !item.is_compulsory).length ?? 0;
  const filteredLineItems = useMemo(() => {
    if (!template) return [];
    const query = search.trim().toLowerCase();
    if (!query) return template.line_items;
    return template.line_items.filter((item) => {
      const scope = [item.name, item.is_compulsory ? "compulsory" : "optional", item.amount].join(" ").toLowerCase();
      return scope.includes(query);
    });
  }, [search, template]);

  async function handleDelete() {
    if (!template) return;
    if (!window.confirm("Delete this fee template?")) return;

    setIsDeleting(true);
    setError(null);
    try {
      await apiClient.delete(`/billing/templates/${template.id}`);
      router.replace("/dashboard/setup/fees");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not delete the fee template.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <DashboardPageShell className="max-w-5xl">
      <DashboardHero
        eyebrow="Setup"
        title="Fee template details"
        description="Inspect the exact line items that will be used when invoices are generated."
        action={(
          <Link href="/dashboard/setup/fees" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
            <ChevronLeft className="h-4 w-4" />
            Back to fee templates
          </Link>
        )}
      />

      <DashboardPanel className="grid gap-6">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-6 w-56 animate-pulse rounded bg-surface-container-low" />
            <div className="h-4 w-80 animate-pulse rounded bg-surface-container-low" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl border border-border/70 bg-surface-container-low" />)}
            </div>
          </div>
        ) : template ? (
          <>
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
              <div className="border-b border-border/70 bg-surface-container-low/60 px-6 py-6 sm:px-8">
                {/* Meta Tags */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                    Template profile
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/70">
                    {template.line_items.length} items
                  </span>
                </div>

                {/* Main Header / Actions */}
                <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
                  <div className="max-w-2xl">
                    <h2 className="font-headline text-3xl font-medium tracking-tight text-on-surface">{template.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{template.description || "No description provided."}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/setup/fees/${template.id}/edit`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                      Edit template
                    </Link>
                    <button
                      onClick={() => void handleDelete()}
                      disabled={isDeleting}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-white px-4 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid border-b border-border/70 sm:grid-cols-3">
                <div className="border-b border-border/70 p-6 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-on-surface-variant/80">Total value</p>
                  <p className="mt-1 font-headline text-2xl font-semibold tracking-tight text-on-surface">{total.toLocaleString("en-NG")}</p>
                </div>
                <div className="border-b border-border/70 p-6 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-on-surface-variant/80">Compulsory</p>
                  <p className="mt-1 font-headline text-2xl font-semibold tracking-tight text-on-surface">{compulsoryCount}</p>
                </div>
                <div className="p-6">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-on-surface-variant/80">Optional</p>
                  <p className="mt-1 font-headline text-2xl font-semibold tracking-tight text-on-surface">{optionalCount}</p>
                </div>
              </div></div>
            <div className="grid gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="font-headline text-lg text-on-surface">Line items</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">Each fee item that makes up this template.</p>
                </div>
                <label className="space-y-2 text-sm text-on-surface-variant md:min-w-[18rem]">
                  <span className="block font-medium">Search</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Search line items"
                  />
                </label>
              </div>

              {filteredLineItems.length === 0 ? (
                <DashboardEmptyState title="No line items" description="This template does not contain any line items yet." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[1.3fr_0.7fr_0.7fr_1fr] bg-surface-container-low px-4 py-3 text-[11px] font-label uppercase tracking-[0.35em] text-on-surface-variant">
                      <span>Line item</span>
                      <span>Type</span>
                      <span>Amount</span>
                      <span>Notes</span>
                    </div>
                    <div className="divide-y divide-border/70 bg-white">
                      {filteredLineItems.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1.3fr_0.7fr_0.7fr_1fr] items-center px-4 py-4">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-on-surface">{item.name}</p>
                            <p className="text-xs text-on-surface-variant">{item.id.slice(0, 8)}</p>
                          </div>
                          <div>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${item.is_compulsory ? "bg-primary/10 text-primary" : "bg-amber-50 text-amber-700"}`}>
                              {item.is_compulsory ? "Compulsory" : "Optional"}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-on-surface">{Number(item.amount).toLocaleString("en-NG")}</div>
                          <div className="text-sm text-on-surface-variant">
                            {item.is_compulsory ? "Included automatically." : "Can be allocated per student."}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error ? <p className="text-xs text-error">{error}</p> : null}
          </>
        ) : (
          <DashboardEmptyState
            title="Template not found"
            description="The fee template could not be loaded."
            action={<Link href="/dashboard/setup/fees" className="text-sm font-semibold text-primary underline underline-offset-4">Back to fee templates</Link>}
          />
        )}
      </DashboardPanel>
    </DashboardPageShell>
  );
}
