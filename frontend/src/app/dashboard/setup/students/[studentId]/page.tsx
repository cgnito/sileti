"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, CalendarDays, Hash, IdCard, PencilLine, School, User } from "lucide-react";
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
    <DashboardPageShell className="max-w-5xl">
      <DashboardHero
        eyebrow="Setup"
        title="Student details"
        description="View the student record exactly as it exists in the school database."
        action={(
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/dashboard/setup/students/${studentId}/edit`} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15">
              <PencilLine className="h-4 w-4" />
              Edit student
            </Link>
            <Link href="/dashboard/setup/students" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
              <ChevronLeft className="h-4 w-4" />
              Back to students
            </Link>
          </div>
        )}
      />

      <DashboardPanel className="grid gap-6">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-6 w-56 animate-pulse rounded bg-surface-container-low" />
            <div className="h-4 w-80 animate-pulse rounded bg-surface-container-low" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl border border-border/70 bg-surface-container-low" />)}
            </div>
          </div>
        ) : student ? (
          <>
            <div className="grid gap-4 rounded-[1.15rem] border border-border/70 bg-surface-container-low p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-[11px] font-label uppercase tracking-[0.35em] text-primary">Student profile</p>
                <h2 className="mt-2 font-headline text-2xl text-on-surface">{student.first_name} {student.last_name}</h2>
                <p className="mt-2 text-sm text-on-surface-variant">{student.silete_id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/setup/students/${student.id}/edit`} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15">
                  <PencilLine className="h-4 w-4" />
                  Edit
                </Link>
                <span className="rounded-full border border-border/70 bg-white px-3 py-1.5 text-xs font-medium text-on-surface">{student.status}</span>
                <span className="rounded-full border border-border/70 bg-white px-3 py-1.5 text-xs font-medium text-on-surface">{student.admission_year}</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <User className="h-4 w-4 text-primary" />
                  Full name
                </div>
                <p className="mt-3 text-base text-on-surface">{student.first_name} {student.last_name}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <Hash className="h-4 w-4 text-primary" />
                  Silete ID
                </div>
                <p className="mt-3 text-base text-on-surface">{student.silete_id}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <School className="h-4 w-4 text-primary" />
                  Class
                </div>
                <p className="mt-3 text-base text-on-surface">{className}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Date of birth
                </div>
                <p className="mt-3 text-base text-on-surface">{formatDate(student.date_of_birth)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <IdCard className="h-4 w-4 text-primary" />
                  Admission year
                </div>
                <p className="mt-3 text-base text-on-surface">{student.admission_year}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <User className="h-4 w-4 text-primary" />
                  Status
                </div>
                <p className="mt-3 text-base capitalize text-on-surface">{student.status}</p>
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

        {error ? <p className="text-xs text-error">{error}</p> : null}
      </DashboardPanel>
    </DashboardPageShell>
  );
}
