import { useEffect, useState, useSyncExternalStore } from "react";
import type { Task } from "./task-types";

const STORAGE_KEY = "tasks.v1";

let tasks: Task[] = [];
const listeners = new Set<() => void>();
let hydrated = false;

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    tasks = raw ? (JSON.parse(raw) as Task[]) : seed();
    if (!raw) persist();
  } catch {
    tasks = [];
  }
  hydrated = true;
}

function persist() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function emit() {
  listeners.forEach((l) => l());
}

function seed(): Task[] {
  return [
    {
      taskId: "K-001",
      name: "Daily revenue check",
      type: "K",
      description: "Verify daily revenue meets target",
      valueType: "Numeric",
      collectionType: "Auto",
      frequency: "Daily",
      thresholdNumeric: 10000,
      thresholdText: "",
      thresholdType: "MIN",
      assignee: "Finance Team",
      active: true,
    },
    {
      taskId: "R-014",
      name: "Quarterly compliance report",
      type: "R",
      description: "Submit compliance documentation",
      valueType: "String",
      collectionType: "Manual",
      frequency: "Quarterly",
      thresholdText: "Submitted",
      thresholdType: "Exact",
      assignee: "Jane Doe",
      active: true,
    },
  ];
}

export const taskStore = {
  getAll: () => tasks,
  get: (id: string) => tasks.find((t) => t.taskId === id),
  upsert(task: Task) {
    const idx = tasks.findIndex((t) => t.taskId === task.taskId);
    if (idx >= 0) tasks[idx] = task;
    else tasks = [task, ...tasks];
    persist();
    emit();
  },
  remove(id: string) {
    tasks = tasks.filter((t) => t.taskId !== id);
    persist();
    emit();
  },
  toggleActive(id: string) {
    const t = tasks.find((x) => x.taskId === id);
    if (t) {
      t.active = !t.active;
      persist();
      emit();
    }
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useTasks(): Task[] {
  const [, setReady] = useState(hydrated);
  useEffect(() => {
    if (!hydrated) {
      load();
      setReady(true);
      emit();
    }
  }, []);
  return useSyncExternalStore(
    (cb) => taskStore.subscribe(cb),
    () => tasks,
    () => [],
  );
}
