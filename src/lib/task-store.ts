import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "./task-types";

let tasks: Task[] = [];
const listeners = new Set<() => void>();
let loaded = false;
let loadPromise: Promise<void> | null = null;

type Row = {
  task_id: string;
  name: string;
  type: string;
  description: string | null;
  value_type: string;
  collection_type: string;
  frequency: string;
  ad_hoc_date: string | null;
  threshold_numeric: number | null;
  threshold_text: string | null;
  threshold_type: string;
  assignee: string;
  active: boolean;
};

function rowToTask(r: Row): Task {
  return {
    taskId: r.task_id,
    name: r.name,
    type: r.type as Task["type"],
    description: r.description ?? "",
    valueType: r.value_type as Task["valueType"],
    collectionType: r.collection_type as Task["collectionType"],
    frequency: r.frequency as Task["frequency"],
    adHocDate: r.ad_hoc_date ?? undefined,
    thresholdNumeric: r.threshold_numeric ?? undefined,
    thresholdText: r.threshold_text ?? "",
    thresholdType: r.threshold_type as Task["thresholdType"],
    assignee: r.assignee,
    active: r.active,
  };
}

function taskToRow(t: Task) {
  return {
    task_id: t.taskId,
    name: t.name,
    type: t.type,
    description: t.description ?? "",
    value_type: t.valueType,
    collection_type: t.collectionType,
    frequency: t.frequency,
    ad_hoc_date: t.adHocDate ?? null,
    threshold_numeric:
      typeof t.thresholdNumeric === "number" && !Number.isNaN(t.thresholdNumeric)
        ? t.thresholdNumeric
        : null,
    threshold_text: t.thresholdText ?? "",
    threshold_type: t.thresholdType,
    assignee: t.assignee,
    active: t.active,
  };
}

function emit() {
  listeners.forEach((l) => l());
}

async function loadFromCloud() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load tasks:", error);
    return;
  }
  tasks = (data as Row[]).map(rowToTask);
  loaded = true;
  emit();
}

function ensureLoaded() {
  if (loaded || loadPromise) return loadPromise;
  loadPromise = loadFromCloud().finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}

if (typeof window !== "undefined") {
  // Realtime sync across clients/tabs
  supabase
    .channel("tasks-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      () => {
        loadFromCloud();
      },
    )
    .subscribe();
}

export const taskStore = {
  getAll: () => tasks,
  get: (id: string) => tasks.find((t) => t.taskId === id),
  async upsert(task: Task) {
    const row = taskToRow(task);
    // Optimistic update
    const idx = tasks.findIndex((t) => t.taskId === task.taskId);
    if (idx >= 0) tasks[idx] = task;
    else tasks = [task, ...tasks];
    emit();
    const { error } = await supabase.from("tasks").upsert(row, { onConflict: "task_id" });
    if (error) {
      console.error("Failed to save task:", error);
      await loadFromCloud();
      throw error;
    }
  },
  async remove(id: string) {
    const prev = tasks;
    tasks = tasks.filter((t) => t.taskId !== id);
    emit();
    const { error } = await supabase.from("tasks").delete().eq("task_id", id);
    if (error) {
      console.error("Failed to delete task:", error);
      tasks = prev;
      emit();
      throw error;
    }
  },
  async toggleActive(id: string) {
    const current = tasks.find((x) => x.taskId === id);
    if (!current) return;
    const next = !current.active;
    const prev = tasks;
    tasks = tasks.map((t) => (t.taskId === id ? { ...t, active: next } : t));
    emit();
    const { error } = await supabase
      .from("tasks")
      .update({ active: next })
      .eq("task_id", id);
    if (error) {
      console.error("Failed to toggle task:", error);
      tasks = prev;
      emit();
      throw error;
    }
  },
  async setActiveMany(ids: string[], active: boolean) {
    if (!ids.length) return;
    const prev = tasks.map((t) => ({ ...t }));
    tasks = tasks.map((t) => (ids.includes(t.taskId) ? { ...t, active } : t));
    emit();
    const { error } = await supabase
      .from("tasks")
      .update({ active })
      .in("task_id", ids);
    if (error) {
      console.error("Failed to bulk update tasks:", error);
      tasks = prev;
      emit();
      throw error;
    }
  },
  async updateMany(ids: string[], patch: Partial<Task>) {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const prev = tasks;
    tasks = tasks.map((t) => (idSet.has(t.taskId) ? { ...t, ...patch } : t));
    emit();
    // Build a row-shaped patch (only include keys present in patch)
    const rowPatch: Partial<Row> = {};
    if ("type" in patch) rowPatch.type = patch.type;
    if ("valueType" in patch) rowPatch.value_type = patch.valueType;
    if ("collectionType" in patch) rowPatch.collection_type = patch.collectionType;
    if ("frequency" in patch) rowPatch.frequency = patch.frequency;
    if ("adHocDate" in patch) rowPatch.ad_hoc_date = patch.adHocDate ?? null;
    if ("thresholdType" in patch) rowPatch.threshold_type = patch.thresholdType;
    if ("thresholdNumeric" in patch)
      rowPatch.threshold_numeric =
        typeof patch.thresholdNumeric === "number" && !Number.isNaN(patch.thresholdNumeric)
          ? patch.thresholdNumeric
          : null;
    if ("thresholdText" in patch) rowPatch.threshold_text = patch.thresholdText ?? "";
    if ("assignee" in patch) rowPatch.assignee = patch.assignee;
    if ("active" in patch) rowPatch.active = patch.active;
    if ("description" in patch) rowPatch.description = patch.description ?? "";
    if ("name" in patch) rowPatch.name = patch.name;
    const { error } = await supabase.from("tasks").update(rowPatch).in("task_id", ids);
    if (error) {
      console.error("Failed to bulk edit tasks:", error);
      tasks = prev;
      emit();
      throw error;
    }
  },
  async removeMany(ids: string[]) {
    if (!ids.length) return;
    const prev = tasks;
    tasks = tasks.filter((t) => !ids.includes(t.taskId));
    emit();
    const { error } = await supabase.from("tasks").delete().in("task_id", ids);
    if (error) {
      console.error("Failed to bulk delete tasks:", error);
      tasks = prev;
      emit();
      throw error;
    }
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useTasks(): Task[] {
  const [snapshot, setSnapshot] = useState<Task[]>(() => [...tasks]);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) setSnapshot([...tasks]);
    };

    update();
    ensureLoaded()?.then(update);
    const unsubscribe = taskStore.subscribe(update);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return snapshot;
}
