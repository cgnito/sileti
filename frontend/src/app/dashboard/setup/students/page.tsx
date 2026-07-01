"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, PencilLine, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";

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
  class_id: string;
  silete_id: string;
  parent_whatsapp: string | null;
  parent_email: string | null;
};

export default function StudentsSetupPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [parentWhatsApp, setParentWhatsApp] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editParentWhatsApp, setEditParentWhatsApp] = useState("");
  const [editParentEmail, setEditParentEmail] = useState("");
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadClasses() {
    setIsLoadingClasses(true);
    setError(null);
    try {
      const data = await apiClient.get<SchoolClass[]>("/classes");
      setClasses(data);
      if (!selectedClassId && data[0]) {
        setSelectedClassId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load classes.");
    } finally {
      setIsLoadingClasses(false);
    }
  }

  async function loadStudents(classId: string) {
    setIsLoadingStudents(true);
    setError(null);
    try {
      const data = await apiClient.get<StudentRecord[]>(`/students?class_id=${classId}`);
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
    if (!selectedClassId) return;
    void loadStudents(selectedClassId);
  }, [selectedClassId]);

  function isValidParentWhatsApp(value: string) {
    const normalized = value.trim();
    if (!normalized) return true;
    const candidate = normalized.startsWith("+234") ? `0${normalized.slice(4)}` : normalized;
    return /^(?:0)(?:702|703|704|706|708|802|803|804|805|806|807|808|809|810|813|814|816|817|818|819|906|907|908|909|701|705|707|709|811|812|815)\d{7}$/.test(candidate);
  }

  function isValidParentEmail(value: string) {
    const normalized = value.trim();
    if (!normalized) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  }

  async function handleCreateStudent() {
    if (!selectedClassId) {
      setError("Choose a class first.");
      return;
    }

    if (!isValidParentWhatsApp(parentWhatsApp)) {
      setError("Enter a valid Nigerian WhatsApp number.");
      return;
    }

    if (!isValidParentEmail(parentEmail)) {
      setError("Enter a valid parent email address.");
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
        parent_whatsapp: parentWhatsApp.trim() || null,
        parent_email: parentEmail.trim() || null,
        class_id: selectedClassId,
      });
      setFirstName("");
      setLastName("");
      setDateOfBirth("");
      setParentWhatsApp("");
      setParentEmail("");
      await loadStudents(selectedClassId);
      setSuccess("Student created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create the student.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpload() {
    if (!selectedClassId || !uploadFile) {
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
      const result = await apiClient.post<{ message: string }>(`/students/bulk-upload/${selectedClassId}`, formData);
      await loadStudents(selectedClassId);
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
      await loadStudents(selectedClassId);
      setSuccess("Student deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not delete the student.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(student: StudentRecord) {
    setEditingStudentId(student.id);
    setEditFirstName(student.first_name);
    setEditLastName(student.last_name);
    setEditDateOfBirth(student.date_of_birth ?? "");
    setEditParentWhatsApp(student.parent_whatsapp ?? "");
    setEditParentEmail(student.parent_email ?? "");
  }

  async function handleUpdateStudent() {
    if (!editingStudentId) return;
    if (!isValidParentWhatsApp(editParentWhatsApp)) {
      setError("Enter a valid Nigerian WhatsApp number.");
      return;
    }
    if (!isValidParentEmail(editParentEmail)) {
      setError("Enter a valid parent email address.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.patch(`/students/${editingStudentId}`, {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        date_of_birth: editDateOfBirth || null,
        parent_whatsapp: editParentWhatsApp.trim() || null,
        parent_email: editParentEmail.trim() || null,
      });
      await loadStudents(selectedClassId);
      setEditingStudentId(null);
      setSuccess("Student updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not update the student.");
    } finally {
      setIsSaving(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => `${student.first_name} ${student.last_name}`.toLowerCase().includes(query));
  }, [search, students]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-xl border border-border bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-on-surface-variant transition-colors hover:text-primary">
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="mt-3 font-headline text-xl font-bold tracking-tight text-on-surface">Students</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Add students one by one or import a classroom roster from CSV.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleCreateStudent()} disabled={isSaving || !selectedClassId} className="w-full md:w-auto">
            <Plus className="h-4 w-4" />
            {isSaving ? "Saving…" : "Add student"}
          </Button>
          <Button variant="secondary" onClick={() => void handleUpload()} disabled={isSaving || !uploadFile || !selectedClassId} className="w-full md:w-auto">
            <Upload className="h-4 w-4" />
            Upload CSV
          </Button>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="student-class">Select class</label>
            <select id="student-class" value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20">
              {isLoadingClasses ? <option value="">Loading classes…</option> : classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="student-search">Search students</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input id="student-search" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Search by name" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="student-first-name">First name</label>
            <input id="student-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="student-last-name">Last name</label>
            <input id="student-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="student-dob">Date of birth</label>
            <input id="student-dob" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="student-parent-whatsapp">Parent WhatsApp Number</label>
            <input id="student-parent-whatsapp" value={parentWhatsApp} onChange={(event) => setParentWhatsApp(event.target.value)} inputMode="tel" placeholder="08031234567" className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="student-parent-email">Parent Email</label>
            <input id="student-parent-email" type="email" value={parentEmail} onChange={(event) => setParentEmail(event.target.value)} placeholder="parent@example.com" className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        {error && <p className="mt-4 text-xs text-error">{error}</p>}
        {success && <p className="mt-4 text-xs text-primary">{success}</p>}
      </section>

      <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-semibold text-on-surface">Students in selected class</h2>
          <input type="file" accept=".csv" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} className="text-sm text-on-surface-variant" />
        </div>
        {isLoadingStudents ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-lg border border-border/70 bg-surface-container-low" />)}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border/70 bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">No students match your current filter.</div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border/70">
            <div className="grid grid-cols-[1.3fr_0.8fr_1.1fr_1.1fr_0.6fr] bg-surface-container-low px-4 py-3 text-[11px] font-label uppercase tracking-[0.35em] text-on-surface-variant">
              <span>Name</span>
              <span>DOB</span>
              <span>Parent WhatsApp</span>
              <span>Parent Email</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-border/70 bg-white">
              {filteredStudents.map((student) => (
                <div key={student.id} className="grid grid-cols-[1.3fr_0.8fr_1.1fr_1.1fr_0.6fr] items-center gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-on-surface">{student.first_name} {student.last_name}</p>
                    <p className="text-xs text-on-surface-variant">{student.silete_id}</p>
                  </div>
                  <div className="text-sm text-on-surface-variant">{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-NG") : "—"}</div>
                  <div className="text-sm text-on-surface-variant">{student.parent_whatsapp ?? "—"}</div>
                  <div className="text-sm text-on-surface-variant">{student.parent_email ?? "—"}</div>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary" onClick={() => startEdit(student)}>
                      <PencilLine className="h-4 w-4" />
                    </button>
                    <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-error" onClick={() => void handleDelete(student.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {editingStudentId === student.id && (
                    <div className="col-span-5 mt-2 rounded-lg border border-border/70 bg-surface-container-low p-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor={`edit-${student.id}-first-name`}>First name</label>
                          <input id={`edit-${student.id}-first-name`} value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor={`edit-${student.id}-last-name`}>Last name</label>
                          <input id={`edit-${student.id}-last-name`} value={editLastName} onChange={(event) => setEditLastName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor={`edit-${student.id}-dob`}>Date of birth</label>
                          <input id={`edit-${student.id}-dob`} type="date" value={editDateOfBirth} onChange={(event) => setEditDateOfBirth(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor={`edit-${student.id}-parent-whatsapp`}>Parent WhatsApp</label>
                          <input id={`edit-${student.id}-parent-whatsapp`} value={editParentWhatsApp} onChange={(event) => setEditParentWhatsApp(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor={`edit-${student.id}-parent-email`}>Parent Email</label>
                          <input id={`edit-${student.id}-parent-email`} type="email" value={editParentEmail} onChange={(event) => setEditParentEmail(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={() => void handleUpdateStudent()} disabled={isSaving}>Save changes</Button>
                        <Button variant="secondary" onClick={() => setEditingStudentId(null)} disabled={isSaving}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
