"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, PencilLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { apiClient } from "@/src/shared/api-client";

type SchoolClass = {
  id: string;
  name: string;
  level: number;
  org_id: string;
};

export default function ClassesSetupPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLevel, setEditingLevel] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadClasses() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<SchoolClass[]>("/classes");
      setClasses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not load classes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClasses();
  }, []);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Enter a class name.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post<SchoolClass>("/classes", { name: name.trim(), level: Number(level) });
      setName("");
      setLevel("1");
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create the class.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(item: SchoolClass) {
    setEditingId(item.id);
    setEditingName(item.name);
    setEditingLevel(String(item.level));
  }

  async function handleUpdate(classId: string) {
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.patch<SchoolClass>(`/classes/${classId}`, {
        name: editingName.trim(),
        level: Number(editingLevel),
      });
      setEditingId(null);
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not update the class.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(classId: string) {
    if (!window.confirm("Delete this class?")) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.delete(`/classes/${classId}`);
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not delete the class.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-xl border border-border bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-on-surface-variant transition-colors hover:text-primary">
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="mt-3 font-headline text-xl font-bold tracking-tight text-on-surface">Classes</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Create and manage the academic arms used by your school.</p>
        </div>
        <Button onClick={handleCreate} disabled={isSaving} className="w-full md:w-auto">
          <Plus className="h-4 w-4" />
          {isSaving ? "Saving…" : "Add class"}
        </Button>
      </header>

      <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="class-name">Class name</label>
            <input id="class-name" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="JSS 1 Gold" />
          </div>
          <div className="space-y-2">
            <label className="mb-1 block text-xs font-semibold font-label uppercase tracking-[0.2em] text-on-surface-variant" htmlFor="class-level">Level</label>
            <input id="class-level" type="number" min="1" max="20" value={level} onChange={(event) => setLevel(event.target.value)} className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        {error && <p className="mt-4 text-xs text-error">{error}</p>}
      </section>

      <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="font-headline text-base font-semibold text-on-surface">Existing classes</h2>
        {isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-lg border border-border/70 bg-surface-container-low" />)}
          </div>
        ) : classes.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border/70 bg-surface-container-low p-8 text-center">
            <p className="text-sm text-on-surface">No classes yet. Add your first class to get started.</p>
            <Button onClick={handleCreate} className="mt-4" disabled={isSaving}>
              <Plus className="h-4 w-4" />
              Create class
            </Button>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border/70">
            <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr] bg-surface-container-low px-4 py-3 text-[11px] font-label uppercase tracking-[0.35em] text-on-surface-variant">
              <span>Class name</span>
              <span>Level</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-border/70 bg-white">
              {classes.map((item) => (
                <div key={item.id} className="grid grid-cols-[1.5fr_0.8fr_0.8fr] items-center gap-3 px-4 py-3">
                  {editingId === item.id ? (
                    <>
                      <input value={editingName} onChange={(event) => setEditingName(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                      <input type="number" min="1" max="20" value={editingLevel} onChange={(event) => setEditingLevel(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => void handleUpdate(item.id)} disabled={isSaving}>Save</Button>
                        <button onClick={() => setEditingId(null)} className="text-sm text-on-surface-variant">Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="font-medium text-on-surface">{item.name}</p>
                      </div>
                      <div className="text-sm text-on-surface-variant">Level {item.level}</div>
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary" onClick={() => startEdit(item)}>
                          <PencilLine className="h-4 w-4" />
                        </button>
                        <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-error" onClick={() => void handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
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
