"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, CalendarDays, Hash, IdCard, Phone, PencilLine, School, User } from "lucide-react";
import { apiClient } from "@/src/shared/api-client";
import { DashboardEmptyState, DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

type SchoolClass = {
  id: string;
  name: string;
  level: number;
};

type StudentDetail = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  parent_phone: string | null;
  class_id: string | null;
  silete_id: string;
  org_id: string;
  status: string;
  admission_year: number;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-NG") : "—";
}

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStudent() {
      setIsLoading(true);
      setError(null);
      try {
        const [studentData, classData] = await Promise.all([
          apiClient.get<StudentDetail>(`/students/${studentId}`),
          apiClient.get<SchoolClass[]>("/classes"),
        ]);

        if (!active) return;
        setStudent(studentData);
        setClasses(classData);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "We could not load this student.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    if (studentId) {
      void loadStudent();
    }

    return () => {
      active = false;
    };
  }, [studentId]);

  const className = useMemo(() => classes.find((item) => item.id === student?.class_id)?.name ?? (student?.class_id ? "Unknown class" : "Not assigned"), [classes, student?.class_id]);

  return (
    <DashboardPageShell className="max-w-4xl">
      <DashboardHero
        eyebrow="Setup"
        title="Student details"
        description="View the student record exactly as it exists in the school database."
        action={(
          <div className="flex items-center gap-4">
            <Link href="/dashboard/setup/students" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary/80 transition-colors hover:text-primary">
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Link>
            <Link href={`/dashboard/setup/students/${studentId}/edit`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary/15">
              <PencilLine className="h-3.5 w-3.5" />
              Edit student
            </Link>
          </div> 
        )}
      />

      <DashboardPanel className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <div className="h-4 w-24 animate-pulse rounded bg-surface-container-low/60" />
            <div className="h-7 w-48 animate-pulse rounded bg-surface-container-low/60" />
            <div className="grid gap-px bg-border/40 mt-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse bg-surface-container-low/30" />
              ))}
            </div>
          </div>
        ) : student ? (
          <>
            {/* Top Profile Summary Banner */}
            <div className="border-b border-border/70 bg-surface-container-low/60 px-6 py-6 sm:px-8">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Student profile</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/60">{student.status}</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant/60">Class of {student.admission_year}</span>
              </div>
              
              <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-baseline">
                <div>
                  <h2 className="font-headline text-3xl font-medium tracking-tight text-on-surface">{student.first_name} {student.last_name}</h2>
                  <p className="mt-1 text-xs font-medium tracking-wide text-on-surface-variant/80">Sileti ID: {student.silete_id}</p>
                </div>
              </div>
            </div>

            {/* Premium Clean Data Grid */}
            <div className="grid gap-px bg-border/70 sm:grid-cols-2">
              <div className="bg-white p-6 transition-colors hover:bg-surface-container-low/20">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/70">
                  <User className="h-3.5 w-3.5 text-primary/70" />
                  Full name
                </div>
                <p className="mt-2 text-base font-medium text-on-surface">{student.first_name} {student.last_name}</p>
              </div>

              <div className="bg-white p-6 transition-colors hover:bg-surface-container-low/20">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/70">
                  <Hash className="h-3.5 w-3.5 text-primary/70" />
                  Sileti ID
                </div>
                <p className="mt-2 text-base font-mono font-medium text-on-surface">{student.silete_id}</p>
              </div>

              <div className="bg-white p-6 transition-colors hover:bg-surface-container-low/20">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/70">
                  <School className="h-3.5 w-3.5 text-primary/70" />
                  Class assignment
                </div>
                <p className="mt-2 text-base font-medium text-on-surface">{className}</p>
              </div>

              <div className="bg-white p-6 transition-colors hover:bg-surface-container-low/20">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/70">
                  <Phone className="h-3.5 w-3.5 text-primary/70" />
                  Parent WhatsApp
                </div>
                <p className="mt-2 text-base font-medium text-on-surface">{student.parent_phone ?? "Not set"}</p>
              </div>

              <div className="bg-white p-6 transition-colors hover:bg-surface-container-low/20">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/70">
                  <CalendarDays className="h-3.5 w-3.5 text-primary/70" />
                  Date of birth
                </div>
                <p className="mt-2 text-base font-medium text-on-surface">{formatDate(student.date_of_birth)}</p>
              </div>

              <div className="bg-white p-6 transition-colors hover:bg-surface-container-low/20">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/70">
                  <IdCard className="h-3.5 w-3.5 text-primary/70" />
                  Admission year
                </div>
                <p className="mt-2 text-base font-medium text-on-surface">{student.admission_year}</p>
              </div>

              <div className="bg-white p-6 transition-colors hover:bg-surface-container-low/20">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant/70">
                  <User className="h-3.5 w-3.5 text-primary/70" />
                  Account status
                </div>
                <p className="mt-2 text-base font-medium capitalize text-on-surface">{student.status}</p>
              </div>
            </div>
          </>
        ) : (
          <DashboardEmptyState
            title="Student not found"
            description="The student record could not be loaded."
            action={<Link href="/dashboard/setup/students" className="text-sm font-semibold text-primary underline underline-offset-4">Back to students</Link>}
          />
        )}

        {error ? (
          <div className="border-t border-border/70 p-4 bg-error/5">
            <p className="text-xs font-medium text-error">{error}</p>
          </div>
        ) : null}
      </DashboardPanel>
    </DashboardPageShell>
  );
}
