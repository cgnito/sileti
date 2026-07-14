"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Save } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";
import { DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";

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
  parent_email: string | null;
  class_id: string | null;
  silete_id: string;
  status: string;
  admission_year: number;
};

export default function StudentEditPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const studentId = params.studentId;
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [classId, setClassId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        setFirstName(studentData.first_name);
        setLastName(studentData.last_name);
        setParentPhone(studentData.parent_phone ?? "");
        setParentEmail(studentData.parent_email ?? "");
        setDateOfBirth(studentData.date_of_birth ?? "");
        setClassId(studentData.class_id ?? classData[0]?.id ?? "");
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

  async function handleSave() {
    if (!student) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.patch(`/students/${student.id}`, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dateOfBirth || null,
        parent_phone: parentPhone.trim() || null,
        parent_email: parentEmail.trim() || null,
        class_id: classId || null,
      });
      setSuccess("Student updated successfully.");
      router.replace(`/dashboard/setup/students/${student.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not update the student.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardPageShell className="max-w-5xl">
      <DashboardHero
        eyebrow="Setup"
        title="Edit student"
        description="Update the student record from one dedicated form."
        action={(
          <Link href={student ? `/dashboard/setup/students/${student.id}` : "/dashboard/setup/students"} className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
            <ChevronLeft className="h-4 w-4" />
            Back to details
          </Link>
        )}
      />

      <DashboardPanel className="grid gap-6">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-6 w-56 animate-pulse rounded bg-surface-container-low" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl border border-border/70 bg-surface-container-low" />)}
            </div>
          </div>
        ) : student ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">First name</span>
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </label>
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Last name</span>
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </label>
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Date of birth</span>
                <input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </label>
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Parent WhatsApp number</span>
                <input
                  value={parentPhone}
                  onChange={(event) => setParentPhone(event.target.value)}
                  placeholder="+2348012345678"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Parent email</span>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(event) => setParentEmail(event.target.value)}
                  placeholder="parent@example.com"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Class</span>
                <select value={classId} onChange={(event) => setClassId(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20">
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="text-xs text-error">{error}</p> : null}
            {success ? <p className="text-xs text-primary">{success}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="secondary" href={`/dashboard/setup/students/${student.id}`}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-surface-container-low p-8 text-center">
            <h2 className="font-headline text-lg text-on-surface">Student not found</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">The student record could not be loaded.</p>
            <div className="mt-5 flex justify-center">
              <Link href="/dashboard/setup/students" className="text-sm font-semibold text-primary underline underline-offset-4">Back to students</Link>
            </div>
          </div>
        )}
      </DashboardPanel>
    </DashboardPageShell>
  );
}
