"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useBillingData, useGenerateBilling } from "@/src/features/dashboard/billing/hooks/billing.hooks";
import type { FeeTemplate, SchoolClass } from "@/src/features/dashboard/billing/types/billing.types";
import { fetchStudents } from "@/src/features/dashboard/billing/api/billing.api";
import type { StudentSummary } from "@/src/features/dashboard/billing/types/billing.types";

export default function BillingGeneratePage() {
  const router = useRouter();
  const { classes, templates, isLoading: isLoadingData, error: loadError } = useBillingData();
  const { run, isLoading: isGenerating, error: submitError } = useGenerateBilling();

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [session, setSession] = useState("");
  const [term, setTerm] = useState("First Term");
  const [dueDate, setDueDate] = useState("");
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedOptionalIds, setSelectedOptionalIds] = useState<Record<string, string[]>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const template = useMemo(
    () => templates.find((item) => item.id === selectedTemplate) ?? null,
    [selectedTemplate, templates],
  );

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      return;
    }

    let active = true;
    async function loadStudents() {
      try {
        const data = await fetchStudents(selectedClass);
        if (active) setStudents(data);
      } catch {
        if (active) setStudents([]);
      }
    }

    void loadStudents();
    return () => {
      active = false;
    };
  }, [selectedClass]);

  useEffect(() => {
    if (!template) return;
    const optionalIds = template.line_items.filter((item) => !item.is_compulsory).map((item) => item.id);
    setSelectedOptionalIds((current) => ({
      ...current,
      [template.id]: optionalIds,
    }));
  }, [template]);

  const optionalItems = useMemo(
    () => template?.line_items.filter((item) => !item.is_compulsory) ?? [],
    [template],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedClass || !selectedTemplate || !session || !term) {
      setSuccessMessage(null);
      return;
    }

    try {
      const payload = {
        class_id: selectedClass,
        template_id: selectedTemplate,
        session,
        term,
        due_date: dueDate || undefined,
        optional_allocations: students.map((student) => ({
          student_id: student.id,
          selected_line_item_ids: selectedOptionalIds[template?.id ?? ""] ?? [],
        })),
      };

      const result = await run(payload);
      setSuccessMessage(result.message);
      router.replace("/dashboard/billing");
    } catch {
      setSuccessMessage(null);
    }
  }

  function toggleOptionalItem(itemId: string) {
    if (!template) return;
    setSelectedOptionalIds((current) => {
      const ids = current[template.id] ?? [];
      return {
        ...current,
        [template.id]: ids.includes(itemId) ? ids.filter((value) => value !== itemId) : [...ids, itemId],
      };
    });
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <p className="font-label text-xs uppercase tracking-[0.25em] text-primary">Billing</p>
          <h1 className="mt-2 font-headline text-3xl text-on-surface">Generate invoices</h1>
          <p className="mt-3 text-sm text-on-surface-variant">Create a new billing batch for a class using an existing fee template.</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium">Class</span>
              <select
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                required
              >
                <option value="">Select a class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium">Fee template</span>
              <select
                value={selectedTemplate}
                onChange={(event) => setSelectedTemplate(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                required
              >
                <option value="">Select a template</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium">Session</span>
              <input
                value={session}
                onChange={(event) => setSession(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                placeholder="2024/2025"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium">Term</span>
              <select
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
              >
                <option value="First Term">First Term</option>
                <option value="Second Term">Second Term</option>
                <option value="Third Term">Third Term</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant md:col-span-2">
              <span className="block font-medium">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
              />
            </label>
          </div>

          {isLoadingData ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-on-surface-variant">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading billing setup…
            </div>
          ) : loadError ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-error">
              <AlertCircle className="h-4 w-4" />
              {loadError}
            </div>
          ) : null}

          {optionalItems.length > 0 && (
            <div className="mt-6 rounded-xl border border-border/70 bg-surface-container-low p-4">
              <h2 className="font-semibold text-on-surface">Optional allocations</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Choose any optional line items to attach to every active student in this class.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {optionalItems.map((item) => {
                  const isSelected = (selectedOptionalIds[template?.id ?? ""] ?? []).includes(item.id);
                  return (
                    <label key={item.id} className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm text-on-surface">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOptionalItem(item.id)} />
                      <span>{item.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {students.length > 0 && (
            <div className="mt-6 rounded-xl border border-border/70 bg-surface-container-low p-4">
              <p className="text-sm text-on-surface-variant">{students.length} active students detected in the selected class.</p>
            </div>
          )}

          {submitError && (
            <div className="mt-6 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
              {submitError}
            </div>
          )}
          {successMessage && (
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {successMessage}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isGenerating || isLoadingData}>
              {isGenerating ? "Generating…" : "Generate invoices"}
            </Button>
            <Link href="/dashboard/billing" className="text-sm font-medium text-primary underline underline-offset-4">
              Back to invoices
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
