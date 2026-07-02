"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

type FeeTemplateLineItem = {
  id: string;
  name: string;
  amount: string;
  is_compulsory: boolean;
};

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

function createLineItem(): FeeTemplateLineItem {
  return {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    amount: "",
    is_compulsory: true,
  };
}

export default function FeeTemplateEditPage() {
  const params = useParams<{ templateId: string }>();
  const router = useRouter();
  const templateId = params.templateId;
  const [template, setTemplate] = useState<FeeTemplate | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftLineItems, setDraftLineItems] = useState<FeeTemplateLineItem[]>([createLineItem()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTemplate() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<FeeTemplate>(`/billing/templates/${templateId}`);
        if (!active) return;
        setTemplate(data);
        setDraftName(data.name);
        setDraftDescription(data.description ?? "");
        setDraftLineItems(
          data.line_items.length > 0
            ? data.line_items.map((item) => ({
                id: item.id,
                name: item.name,
                amount: item.amount.toString(),
                is_compulsory: item.is_compulsory,
              }))
            : [createLineItem()]
        );
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
    () => draftLineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [draftLineItems]
  );

  function updateLineItem(index: number, field: keyof FeeTemplateLineItem, value: string | boolean) {
    setDraftLineItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  function addLineItem() {
    setDraftLineItems((current) => [...current, createLineItem()]);
  }

  function removeLineItem(lineItemId: string) {
    setDraftLineItems((current) => (current.length > 1 ? current.filter((item) => item.id !== lineItemId) : current));
  }

  async function handleSave() {
    if (!template) return;

    const payloadLineItems = draftLineItems
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        amount: Number(item.amount),
        is_compulsory: item.is_compulsory,
      }));

    if (!draftName.trim() || payloadLineItems.length === 0) {
      setError("Enter a template name and at least one fee line item.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await apiClient.patch<FeeTemplate>(`/billing/templates/${template.id}`, {
        name: draftName.trim(),
        description: draftDescription.trim() || null,
        line_items: payloadLineItems,
      });
      setTemplate(updated);
      setSuccess("Fee template updated successfully.");
      router.replace(`/dashboard/setup/fees/${updated.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not update the fee template.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardPageShell className="max-w-5xl">
      <DashboardHero
        eyebrow="Setup"
        title="Edit fee template"
        description="Update the template details and line items that will be used when invoices are generated."
        action={(
          <Link href={`/dashboard/setup/fees/${templateId}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
            <ChevronLeft className="h-4 w-4" />
            Back to details
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
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Template name</span>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="First Term - JSS1 Standard Package"
                />
              </label>
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Description</span>
                <input
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Optional description"
                />
              </label>
            </div>

            <div className="grid gap-4 rounded-[1.15rem] border border-border/70 bg-surface-container-low p-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h2 className="font-headline text-lg text-on-surface">{template.name}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">{draftDescription || "No description provided."}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white px-4 py-3 text-right">
                <p className="text-[11px] font-label uppercase tracking-[0.35em] text-on-surface-variant">Current total</p>
                <p className="mt-1 font-headline text-xl text-on-surface">{total.toLocaleString("en-NG")}</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline text-lg text-on-surface">Line items</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">Edit, remove, or add the fee items attached to this package.</p>
                </div>
                <button type="button" onClick={addLineItem} className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                  <Plus className="h-4 w-4" />
                  Add row
                </button>
              </div>

              <div className="grid gap-3">
                {draftLineItems.map((item, index) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-border/70 bg-white p-4 md:grid-cols-[2fr_1fr_auto_auto] md:items-center">
                    <input
                      value={item.name}
                      onChange={(event) => updateLineItem(index, "name", event.target.value)}
                      className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="Tuition fee"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={(event) => updateLineItem(index, "amount", event.target.value)}
                      className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                      placeholder="150000"
                    />
                    <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                      <input type="checkbox" checked={item.is_compulsory} onChange={(event) => updateLineItem(index, "is_compulsory", event.target.checked)} />
                      Compulsory
                    </label>
                    <button type="button" onClick={() => removeLineItem(item.id)} className="inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {error ? <p className="text-xs text-error">{error}</p> : null}
            {success ? <p className="text-xs text-primary">{success}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="secondary" href={`/dashboard/setup/fees/${template.id}`}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-surface-container-low p-8 text-center">
            <h2 className="font-headline text-lg text-on-surface">Template not found</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">The fee template could not be loaded.</p>
            <div className="mt-5 flex justify-center">
              <Link href="/dashboard/setup/fees" className="text-sm font-semibold text-primary underline underline-offset-4">Back to fee templates</Link>
            </div>
          </div>
        )}
      </DashboardPanel>
    </DashboardPageShell>
  );
}
