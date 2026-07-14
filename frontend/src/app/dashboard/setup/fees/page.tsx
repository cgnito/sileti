"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, PencilLine, Plus, Trash2 } from "lucide-react";
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
  const [search, setSearch] = useState("");
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

  const filteredTemplates = templates.filter((template) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      template.name.toLowerCase().includes(query) ||
      (template.description ?? "").toLowerCase().includes(query) ||
      template.line_items.some((item) => item.name.toLowerCase().includes(query))
    );
  });

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
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-headline text-lg text-on-surface">Existing templates</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Search by template name, description, or line item.</p>
          </div>
          <label className="space-y-2 text-sm text-on-surface-variant md:min-w-[18rem]">
            <span className="block font-medium">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Search templates"
            />
          </label>
        </div>
        {isLoading ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-border/70 bg-surface-container-low" />)}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <DashboardEmptyState className="mt-4" title="No fee templates yet" description="Create your first package to get started." />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border/70">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[1.2fr_1.2fr_0.6fr_0.6fr_0.9fr] bg-surface-container-low px-4 py-3 text-[11px] font-label uppercase tracking-[0.35em] text-on-surface-variant">
                <span>Template</span>
                <span>Description</span>
                <span>Items</span>
                <span>Total</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-border/70 bg-white">
                {filteredTemplates.map((template) => {
                  const total = template.line_items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
                  return (
                    <div key={template.id} className="grid grid-cols-[1.2fr_1.2fr_0.6fr_0.6fr_0.9fr] items-center px-4 py-4 transition-colors hover:bg-surface-container-low">
                      <div className="min-w-0">
                        <Link href={`/dashboard/setup/fees/${template.id}`} className="truncate font-semibold text-on-surface underline-offset-4 hover:underline">
                          {template.name}
                        </Link>
                      </div>
                      <div className="min-w-0 text-sm text-on-surface-variant">
                        <p className="truncate">{template.description || "No description"}</p>
                      </div>
                      <div className="text-sm text-on-surface-variant">{template.line_items.length}</div>
                      <div className="text-sm font-semibold text-on-surface">{total.toLocaleString("en-NG")}</div>
                      <div className="flex items-center gap-2 text-sm">
                        <Link href={`/dashboard/setup/fees/${template.id}`} className="font-semibold text-primary underline underline-offset-4">
                          View details
                        </Link>
                        <Link
                          href={`/dashboard/setup/fees/${template.id}/edit`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-container-low text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                          aria-label={`Edit ${template.name}`}
                          title="Edit template"
                        >
                          <PencilLine className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-container-low text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
                          aria-label={`Delete ${template.name}`}
                          title="Delete template"
                          onClick={() => void handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
