"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";
import { DashboardEmptyState, DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

type FeeTemplateLineItem = {
  id: string;
  name: string;
  amount: string;
  is_optional: boolean;
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

export default function FeesSetupPage() {
  const [templates, setTemplates] = useState<FeeTemplate[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lineItems, setLineItems] = useState<FeeTemplateLineItem[]>([createLineItem()]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function createLineItem(): FeeTemplateLineItem {
    return {
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "",
      amount: "",
      is_optional: false,
    };
  }

  async function loadTemplates() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<FeeTemplate[]>("/billing/templates");
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load fee templates.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  function updateLineItem(index: number, field: keyof FeeTemplateLineItem, value: string | boolean) {
    setLineItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  function addLineItem() {
    setLineItems((current) => [...current, createLineItem()]);
  }

  function removeLineItem(lineItemId: string) {
    setLineItems((current) => current.filter((item) => item.id !== lineItemId));
  }

  async function handleCreateTemplate() {
    const payloadLineItems = lineItems
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        amount: Number(item.amount),
        is_compulsory: !item.is_optional,
      }));

    if (!name.trim() || payloadLineItems.length === 0) {
      setError("Enter a template name and at least one fee line item.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.post("/billing/templates", {
        name: name.trim(),
        description: description.trim() || null,
        line_items: payloadLineItems,
      });
      setName("");
      setDescription("");
      setLineItems([createLineItem()]);
      await loadTemplates();
      setSuccess("Fee template created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create the fee template.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(templateId: string) {
    if (!window.confirm("Delete this fee template?")) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.delete(`/billing/templates/${templateId}`);
      await loadTemplates();
      setSuccess("Fee template deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not delete the fee template.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardPageShell>
      <DashboardHero
        eyebrow="Setup"
        title="Fee templates"
        description="Create reusable fee packages for invoice generation."
        action={(
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
            <ChevronLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        )}
      />

      <DashboardPanel className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium text-on-surface">Template name</span>
            <input id="template-name" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="First Term - JSS1 Standard Package" />
          </label>
          <label className="space-y-2 text-sm text-on-surface-variant">
            <span className="block font-medium text-on-surface">Description</span>
            <input id="template-description" value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Optional description" />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-lg text-on-surface">Line items</h2>
            <button type="button" onClick={addLineItem} className="text-sm font-medium text-primary">Add row</button>
          </div>
          {lineItems.map((item, index) => (
            <div key={item.id} className="grid gap-3 rounded-xl border border-border/70 bg-surface-container-low p-4 md:grid-cols-[2fr_1fr_auto_auto]">
              <input value={item.name} onChange={(event) => updateLineItem(index, "name", event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Tuition fee" />
              <input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => updateLineItem(index, "amount", event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="150000" />
              <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                <input type="checkbox" checked={item.is_optional} onChange={(event) => updateLineItem(index, "is_optional", event.target.checked)} />
                Optional
              </label>
              <button type="button" onClick={() => removeLineItem(item.id)} className="text-sm font-medium text-on-surface-variant">Remove</button>
            </div>
          ))}
        </div>

        {error ? <p className="text-xs text-error">{error}</p> : null}
        {success ? <p className="text-xs text-primary">{success}</p> : null}

        <div className="flex justify-start">
          <Button onClick={() => void handleCreateTemplate()} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            {isSaving ? "Saving…" : "Create template"}
          </Button>
        </div>
      </DashboardPanel>

      <DashboardPanel>
        <h2 className="font-headline text-lg text-on-surface">Existing templates</h2>
        {isLoading ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-border/70 bg-surface-container-low" />)}
          </div>
        ) : templates.length === 0 ? (
          <DashboardEmptyState className="mt-4" title="No fee templates yet" description="Create your first package to get started." />
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {templates.map((template) => {
              const total = template.line_items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
              return (
                <div key={template.id} className="rounded-xl border border-border/70 bg-surface-container-low p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-on-surface">{template.name}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">{template.description || "No description"}</p>
                    </div>
                    <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-white hover:text-error" onClick={() => void handleDelete(template.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {template.line_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-white px-3 py-2 text-sm">
                        <span className="text-on-surface">{item.name}</span>
                        <span className="text-on-surface-variant">{Number(item.amount).toLocaleString("en-NG")}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-sm">
                    <span className="text-on-surface-variant">{template.line_items.length} line item(s)</span>
                    <span className="font-semibold text-on-surface">Total {total.toLocaleString("en-NG")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardPanel>
    </DashboardPageShell>
  );
}
