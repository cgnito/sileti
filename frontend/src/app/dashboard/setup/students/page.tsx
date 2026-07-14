"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, PencilLine, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";
import { DashboardEmptyState, DashboardHero, DashboardPageShell, DashboardPanel } from "@/src/components/dashboard/PageChrome";
import { useAuthStore } from "@/src/features/auth/store/useAuthStore";

type SchoolClass = {
  id: string;
  name: string;
  level: number;
};

type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  class_id: string | null;
  silete_id: string;
  parent_email: string | null;
};

export default function StudentsSetupPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [createClassId, setCreateClassId] = useState("");
  const [listClassId, setListClassId] = useState("");
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadClasses() {
    setIsLoadingClasses(true);
    setError(null);
    try {
      const data = await apiClient.get<SchoolClass[]>("/classes");
      setClasses(data);
      if (!createClassId && data[0]) {
        setCreateClassId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load classes.");
    } finally {
      setIsLoadingClasses(false);
    }
  }

  async function loadStudents(classId?: string) {
    setIsLoadingStudents(true);
    setError(null);
    try {
      const path = classId ? `/students?class_id=${classId}` : "/students";
      const data = await apiClient.get<StudentRecord[]>(path);
      setStudents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load students.");
    } finally {
      setIsLoadingStudents(false);
    }
  }

  useEffect(() => {
    void loadClasses();
  }, []);

  useEffect(() => {
    void loadStudents(listClassId || undefined);
  }, [listClassId]);

  async function handleCreateStudent() {
    if (!createClassId) {
      setError("Choose a class first.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.post("/students", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dateOfBirth || null,
        parent_phone: parentPhone.trim() || null,
        parent_email: parentEmail.trim() || null,
        class_id: createClassId,
      });
      setFirstName("");
      setLastName("");
      setParentPhone("");
      setParentEmail("");
      setDateOfBirth("");
      await loadStudents(listClassId || undefined);
      setSuccess("Student created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create the student.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpload() {
    if (!createClassId || !uploadFile) {
      setError("Choose a class and a CSV file first.");
      return;
    }

    if (!uploadFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const result = await apiClient.post<{ message: string }>(`/students/bulk-upload/${createClassId}`, formData);
      await loadStudents(listClassId || undefined);
      setUploadFile(null);
      setSuccess(result.message || "Students uploaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not upload the CSV file.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(studentId: string) {
    if (!window.confirm("Delete this student?")) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.delete(`/students/${studentId}`);
      await loadStudents(listClassId || undefined);
      setSuccess("Student deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not delete the student.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkPromotion() {
    if (!isAdmin) return;

    if (!window.confirm("Promote active students to the next class and graduate the final class?")) return;

    setIsPromoting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await apiClient.post<{ graduated: number; promoted: number; message: string }>("/students/bulk-promotion");
      await loadStudents(listClassId || undefined);
      await loadClasses();
      setSuccess(result.message || "Bulk promotion completed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not complete the promotion run.");
    } finally {
      setIsPromoting(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => `${student.first_name} ${student.last_name}`.toLowerCase().includes(query));
  }, [search, students]);

  return (
    <DashboardPageShell>
      <DashboardHero
        eyebrow="Setup"
        title="Students"
        description="Add students one by one or import a classroom roster from CSV."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardPanel className="grid gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-headline text-lg text-on-surface">Add student</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Create a student profile and assign it to a class.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-on-surface-variant md:col-span-2">
              <span className="block font-medium text-on-surface">Select class</span>
              <select id="student-class" value={createClassId} onChange={(event) => setCreateClassId(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20">
                {isLoadingClasses ? <option value="">Loading classes…</option> : classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium text-on-surface">First name</span>
              <input id="student-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant">
              <span className="block font-medium text-on-surface">Last name</span>
              <input id="student-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant md:col-span-2">
              <span className="block font-medium text-on-surface">Parent WhatsApp number</span>
              <input
                id="student-parent-phone"
                value={parentPhone}
                onChange={(event) => setParentPhone(event.target.value)}
                placeholder="+2348012345678"
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-on-surface-variant">This number will be used for invoice and payment notifications.</p>
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant md:col-span-2">
              <span className="block font-medium text-on-surface">Parent email</span>
              <input
                id="student-parent-email"
                type="email"
                value={parentEmail}
                onChange={(event) => setParentEmail(event.target.value)}
                placeholder="parent@example.com"
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-on-surface-variant">This email will receive invoice and payment updates.</p>
            </label>
            <label className="space-y-2 text-sm text-on-surface-variant md:col-span-2">
              <span className="block font-medium text-on-surface">Date of birth</span>
              <input id="student-dob" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <p className="text-xs text-on-surface-variant md:col-span-2">CSV uploads can include `parent_phone` and `parent_email` columns for notification delivery.</p>
          </div>

          {error ? <p className="text-xs text-error">{error}</p> : null}
          {success ? <p className="text-xs text-primary">{success}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleCreateStudent()} disabled={isSaving || !createClassId}>
              <Plus className="h-4 w-4" />
              {isSaving ? "Saving…" : "Add student"}
            </Button>
            <Button variant="secondary" onClick={() => void handleUpload()} disabled={isSaving || !uploadFile || !createClassId}>
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
          </div>
        </DashboardPanel>

        <div className="grid gap-6">
          <DashboardPanel className="grid gap-4">
            <div>
              <h2 className="font-headline text-lg text-on-surface">Search students</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Filter the list below without mixing search into the create form.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">Search by name</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                  <input id="student-search" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Start typing a student name" />
                </div>
              </label>
              <label className="space-y-2 text-sm text-on-surface-variant">
                <span className="block font-medium text-on-surface">List class filter</span>
                <select value={listClassId} onChange={(event) => setListClassId(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <option value="">All classes</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </DashboardPanel>

          {isAdmin ? (
            <DashboardPanel className="grid gap-4">
              <div>
                <h2 className="font-headline text-lg text-on-surface">Class promotion</h2>
                <p className="mt-1 text-sm text-on-surface-variant">Move active students up a class or graduate the final class at session rollover.</p>
              </div>
              <Button variant="secondary" onClick={() => void handleBulkPromotion()} disabled={isSaving || isPromoting}>
                {isPromoting ? "Promoting…" : "Run bulk promotion"}
              </Button>
            </DashboardPanel>
          ) : null}
        </div>
      </div>

      <DashboardPanel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-headline text-lg text-on-surface">{listClassId ? "Students in filtered class" : "All students"}</h2>
          <input type="file" accept=".csv" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} className="text-sm text-on-surface-variant" />
        </div>
        {isLoadingStudents ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-lg border border-border/70 bg-surface-container-low" />)}
          </div>
        ) : filteredStudents.length === 0 ? (
          <DashboardEmptyState className="mt-4" title="No students found" description="No students match your current filter." />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border/70">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.3fr_0.8fr_0.6fr] bg-surface-container-low px-4 py-3 text-[11px] font-label uppercase tracking-[0.35em] text-on-surface-variant">
                <span>Name</span>
                <span>DOB</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-border/70 bg-white">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="grid grid-cols-[1.3fr_0.8fr_0.6fr] items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-on-surface">{student.first_name} {student.last_name}</p>
                      <p className="truncate text-xs text-on-surface-variant">{student.silete_id}</p>
                    </div>
                    <div className="text-sm text-on-surface-variant">{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-NG") : "—"}</div>
                    <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                      <Link href={`/dashboard/setup/students/${student.id}`} className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary">
                        <Eye className="h-4 w-4" />
                        Details
                      </Link>
                      <Link href={`/dashboard/setup/students/${student.id}/edit`} className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary">
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </Link>
                      <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-error" onClick={() => void handleDelete(student.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DashboardPanel>
    </DashboardPageShell>
  );
}
