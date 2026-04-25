import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Search, ListChecks, Download, Upload, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { exportTasksToXlsx, parseTasksFromFile } from "@/lib/task-xlsx";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskForm } from "@/components/TaskForm";
import { taskStore, useTasks } from "@/lib/task-store";
import type { Task } from "@/lib/task-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Task Manager — Collect & Manage Tasks" },
      { name: "description", content: "Create, manage and track operational tasks with thresholds, frequencies and assignees." },
    ],
  }),
  component: Index,
});

function Index() {
  const tasks = useTasks();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { valid, errors } = await parseTasksFromFile(file);
      let added = 0;
      let updated = 0;
      valid.forEach((t) => {
        if (taskStore.get(t.taskId)) updated++;
        else added++;
        taskStore.upsert(t);
      });
      if (errors.length) {
        toast.warning(`Imported ${valid.length} (${added} new, ${updated} updated). ${errors.length} row(s) skipped`, {
          description: errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.message}`).join(" • "),
        });
      } else {
        toast.success(`Imported ${valid.length} task(s) — ${added} new, ${updated} updated`);
      }
    } catch (err) {
      toast.error("Failed to read file", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const assignees = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean))).sort(),
    [tasks],
  );

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (frequencyFilter !== "all" && t.frequency !== frequencyFilter) return false;
      if (assigneeFilter !== "all" && t.assignee !== assigneeFilter) return false;
      if (activeFilter === "active" && !t.active) return false;
      if (activeFilter === "inactive" && t.active) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        t.taskId.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q)
      );
    });
  }, [tasks, query, typeFilter, frequencyFilter, assigneeFilter, activeFilter]);

  const hasActiveFilters =
    typeFilter !== "all" ||
    frequencyFilter !== "all" ||
    assigneeFilter !== "all" ||
    activeFilter !== "all" ||
    query !== "";

  const clearFilters = () => {
    setQuery("");
    setTypeFilter("all");
    setFrequencyFilter("all");
    setAssigneeFilter("all");
    setActiveFilter("all");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const selectedIds = useMemo(
    () => filtered.map((t) => t.taskId).filter((id) => selected.has(id)),
    [filtered, selected],
  );
  const allVisibleSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const someVisibleSelected = selectedIds.length > 0 && !allVisibleSelected;
  const toggleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((t) => t.taskId)) : new Set());
  };

  const bulkSetActive = async (active: boolean) => {
    try {
      await taskStore.setActiveMany(selectedIds, active);
      toast.success(`${selectedIds.length} task(s) ${active ? "activated" : "deactivated"}`);
      clearSelection();
    } catch {
      toast.error("Failed to update tasks");
    }
  };
  const bulkDelete = async () => {
    const count = selectedIds.length;
    try {
      await taskStore.removeMany(selectedIds);
      toast.success(`${count} task(s) deleted`);
      clearSelection();
    } catch {
      toast.error("Failed to delete tasks");
    } finally {
      setBulkDeleteOpen(false);
    }
  };
  const setActiveByType = async (type: Task["type"], active: boolean) => {
    const ids = tasks.filter((t) => t.type === type).map((t) => t.taskId);
    if (!ids.length) return toast.info(`No tasks of type ${type}`);
    try {
      await taskStore.setActiveMany(ids, active);
      toast.success(`${ids.length} ${type} task(s) ${active ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update tasks");
    }
  };

  const stats = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter((t) => t.active).length,
    auto: tasks.filter((t) => t.collectionType === "Auto").length,
  }), [tasks]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />

      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Task Manager</h1>
              <p className="text-xs text-muted-foreground">Collect, manage & edit operational tasks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!tasks.length) return toast.info("No tasks to export");
                exportTasksToXlsx(tasks);
                toast.success("Exported to XLSX");
              }}
            >
              <Download className="mr-2 h-4 w-4" />Export
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">By type</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Toggle active by type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["K", "R", "O"] as const).map((t) => (
                  <div key={t}>
                    <DropdownMenuItem onClick={() => setActiveByType(t, true)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />Activate all {t}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveByType(t, false)}>
                      <XCircle className="mr-2 h-4 w-4" />Deactivate all {t}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />New task</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
                <TaskForm onDone={() => setCreateOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total tasks" value={stats.total} />
          <StatCard label="Active" value={stats.active} />
          <StatCard label="Auto-collected" value={stats.auto} />
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID, name, assignee…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="K">K</SelectItem>
                <SelectItem value="R">R</SelectItem>
                <SelectItem value="O">O</SelectItem>
              </SelectContent>
            </Select>
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Frequency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All frequencies</SelectItem>
                <SelectItem value="Daily">Daily</SelectItem>
                <SelectItem value="Weekly">Weekly</SelectItem>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Quarterly">Quarterly</SelectItem>
                <SelectItem value="Yearly">Yearly</SelectItem>
                <SelectItem value="Ad-hoc">Ad-hoc</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Assignee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <span className="ml-auto text-sm text-muted-foreground">
              {filtered.length} of {tasks.length}
            </span>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-accent/40 px-3 py-2">
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => bulkSetActive(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Activate
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetActive(false)}>
                <XCircle className="mr-2 h-4 w-4" />Deactivate
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleSelectAll(v === true)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                    No tasks found. Click “New task” to add one.
                  </TableCell>
                </TableRow>
              ) : filtered.map((t) => (
                <TableRow key={t.taskId} data-state={selected.has(t.taskId) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(t.taskId)}
                      onCheckedChange={() => toggleSelect(t.taskId)}
                      aria-label={`Select ${t.taskId}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.taskId}</TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell><Badge variant="secondary">{t.type}</Badge></TableCell>
                  <TableCell>
                    {t.frequency}
                    {t.frequency === "Ad-hoc" && t.adHocDate ? ` (${t.adHocDate})` : ""}
                  </TableCell>
                  <TableCell>{t.collectionType}</TableCell>
                  <TableCell className="text-sm">
                    <span className="text-muted-foreground">{t.thresholdType}:</span>{" "}
                    {t.thresholdNumeric ?? t.thresholdText ?? "—"}
                  </TableCell>
                  <TableCell>{t.assignee}</TableCell>
                  <TableCell>
                    <Switch
                      checked={t.active}
                      onCheckedChange={() => taskStore.toggleActive(t.taskId)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(t.taskId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit task</DialogTitle></DialogHeader>
          {editing && <TaskForm initial={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove “{deletingId}”. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) taskStore.remove(deletingId);
                setDeletingId(null);
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} task(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
