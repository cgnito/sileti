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
            <div className="grid gap-4 rounded-[1.15rem] border border-border/70 bg-surface-container-low p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-[11px] font-label uppercase tracking-[0.35em] text-primary">Template profile</p>
                <h2 className="mt-2 font-headline text-2xl text-on-surface">{template.name}</h2>
                <p className="mt-2 text-sm text-on-surface-variant">{template.description || "No description provided."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/setup/fees/${template.id}/edit`} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15">
                  <PencilLine className="h-4 w-4" />
                  Edit template
                </Link>
                <button onClick={() => void handleDelete()} disabled={isDeleting} className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed">
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-white p-4">
                <p className="text-sm font-medium text-on-surface">Template name</p>
                <p className="mt-3 text-base text-on-surface">{template.name}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white p-4">
                <p className="text-sm font-medium text-on-surface">Line items</p>
                <p className="mt-3 text-base text-on-surface">{template.line_items.length} item(s)</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white p-4 md:col-span-2">
                <p className="text-sm font-medium text-on-surface">Total</p>
                <p className="mt-3 text-base text-on-surface">{total.toLocaleString("en-NG")}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {template.line_items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/70 bg-surface-container-low p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-on-surface">{item.name}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{item.is_compulsory ? "Compulsory line item" : "Optional line item"}</p>
                    </div>
                    <span className="text-sm font-semibold text-on-surface">{Number(item.amount).toLocaleString("en-NG")}</span>
                  </div>
                </div>
              ))}
            </div>

            {template.line_items.length === 0 ? (
              <DashboardEmptyState title="No line items" description="This template does not contain any line items yet." />
            ) : null}

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
