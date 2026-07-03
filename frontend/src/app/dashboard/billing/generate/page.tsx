"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useBillingData, useGenerateBilling } from "@/src/features/dashboard/billing/hooks/billing.hooks";
import { fetchStudents } from "@/src/features/dashboard/billing/api/billing.api";
import type { StudentSummary } from "@/src/features/dashboard/billing/types/billing.types";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

export default function BillingGeneratePage() {
  const router = useRouter();
  const { classes, templates, load, isLoading: isLoadingData, error: loadError } = useBillingData();
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
      setSelectedOptionalIds({});
      return;
    }

    let active = true;
    async function loadStudents() {
      try {
        const data = await fetchStudents(selectedClass);
        if (active) {
          setStudents(data);
          setSelectedOptionalIds((current) => {
            const next: Record<string, string[]> = {};
            for (const student of data) {
              next[student.id] = current[student.id] ?? [];
            }
            return next;
          });
        }
      } catch {
        if (active) {
          setStudents([]);
          setSelectedOptionalIds({});
        }
      }
    }

    void loadStudents();
    return () => {
      active = false;
    };
  }, [selectedClass]);

  useEffect(() => {
    if (!template) return;
    setSelectedOptionalIds((current) => {
      const next: Record<string, string[]> = {};
      for (const student of students) {
        next[student.id] = current[student.id] ?? [];
      }
      return next;
    });
  }, [template, students]);

  const optionalItems = useMemo(
    () => template?.line_items.filter((item) => !item.is_compulsory) ?? [],
    [template],
  );

  const allocationCount = useMemo(
    () => Object.values(selectedOptionalIds).reduce((total, ids) => total + ids.length, 0),
    [selectedOptionalIds],
  );

  const allocationGridColumns = useMemo(() => {
    const optionalColumns = optionalItems.map(() => "minmax(8rem, 0.8fr)").join(" ");
    return `minmax(16rem, 1.5fr) minmax(7rem, 0.8fr) ${optionalColumns}`.trim();
  }, [optionalItems]);

  useEffect(() => {
    void load();
  }, [load]);

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
          selected_line_item_ids: selectedOptionalIds[student.id] ?? [],
        })),
      };

      const result = await run(payload);
      setSuccessMessage(result.message);
      router.replace("/dashboard/billing");
    } catch {
      setSuccessMessage(null);
    }
  }

  function toggleStudentOptional(studentId: string, itemId: string) {
    setSelectedOptionalIds((current) => {
      const ids = current[studentId] ?? [];
      return {
        ...current,
        [studentId]: ids.includes(itemId) ? ids.filter((value) => value !== itemId) : [...ids, itemId],
      };
    });
  }

  return (
    <DashboardPageShell className="max-w-5xl">
      <DashboardHero
        eyebrow="Billing"
        title="Generate invoices"
        description="Create a new billing batch for a class using an existing fee template."
      />

      <DashboardPanel>
        <form onSubmit={handleSubmit} className="grid gap-6">
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-semibold text-on-surface">Optional allocations</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">Tick the students who should receive each optional fee.</p>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {allocationCount} optional assignment{allocationCount === 1 ? "" : "s"} selected
                </p>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-border/70 bg-white">
                <div className="min-w-[840px]">
                  <div className="grid bg-surface-container-low px-4 py-3 text-[11px] font-label uppercase tracking-[0.35em] text-on-surface-variant" style={{ gridTemplateColumns: allocationGridColumns }}>
                    <span>Student</span>
                    <span>ID</span>
                    {optionalItems.map((item) => (
                      <span key={item.id} className="text-center">{item.name}</span>
                    ))}
                  </div>
                  <div className="divide-y divide-border/70">
                    {students.map((student) => (
                      <div key={student.id} className="grid items-center px-4 py-3" style={{ gridTemplateColumns: allocationGridColumns }}>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-on-surface">{student.first_name} {student.last_name}</p>
                          <p className="truncate text-xs text-on-surface-variant">{student.school_class?.name ?? "Selected class"}</p>
                        </div>
                        <div className="truncate text-sm text-on-surface-variant">{student.silete_id}</div>
                        {optionalItems.map((item) => {
                          const isSelected = (selectedOptionalIds[student.id] ?? []).includes(item.id);
                          return (
                            <label key={item.id} className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudentOptional(student.id, item.id)}
                                aria-label={`Assign ${item.name} to ${student.first_name} ${student.last_name}`}
                              />
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
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
      </DashboardPanel>
    </DashboardPageShell>
  );
}
