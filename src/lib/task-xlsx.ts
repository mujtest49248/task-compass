import * as XLSX from "xlsx";
import { taskSchema, type Task } from "./task-types";

const HEADERS = [
  "taskId",
  "name",
  "type",
  "description",
  "link",
  "valueType",
  "collectionType",
  "frequency",
  "adHocDate",
  "thresholdNumeric",
  "thresholdText",
  "thresholdType",
  "assignee",
  "active",
] as const;

export function exportTasksToXlsx(tasks: Task[]) {
  const rows = tasks.map((t) => ({
    taskId: t.taskId,
    name: t.name,
    type: t.type,
    description: t.description ?? "",
    link: t.link ?? "",
    valueType: t.valueType,
    collectionType: t.collectionType,
    frequency: t.frequency,
    adHocDate: t.adHocDate ?? "",
    thresholdNumeric: t.thresholdNumeric ?? "",
    thresholdText: t.thresholdText ?? "",
    thresholdType: t.thresholdType ?? "",
    assignee: t.assignee,
    active: t.active ? "TRUE" : "FALSE",
  }));
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS as unknown as string[] });
  ws["!cols"] = HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `tasks-${stamp}.xlsx`);
}

export function exportTasksToJson(tasks: Task[]) {
  const json = JSON.stringify(tasks, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tasks-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type DraftTask = Partial<Task> & { taskId?: string };

export interface DraftRow {
  row: number;
  draft: DraftTask;
  fieldErrors: Record<string, string>;
}

export interface ImportResult {
  valid: Task[];
  drafts: DraftRow[];
}

function validateDraft(draft: DraftTask): { task?: Task; fieldErrors: Record<string, string> } {
  const candidate = {
    ...draft,
    description: draft.description ?? "",
    thresholdText: draft.thresholdText ?? "",
    thresholdNumeric:
      typeof draft.thresholdNumeric === "number" && !Number.isNaN(draft.thresholdNumeric)
        ? draft.thresholdNumeric
        : undefined,
  };
  const parsed = taskSchema.safeParse(candidate);
  if (parsed.success) return { task: parsed.data, fieldErrors: {} };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { fieldErrors };
}

export function validateDraftRow(draft: DraftTask) {
  return validateDraft(draft);
}

export async function parseTasksFromFile(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const valid: Task[] = [];
  const drafts: DraftRow[] = [];

  raw.forEach((r, i) => {
    const rowNum = i + 2;
    const activeStr = String(r.active ?? "").trim();
    const activeRaw = activeStr.toLowerCase();
    const numRaw = r.thresholdNumeric;
    const draft: DraftTask = {
      taskId: String(r.taskId ?? "").trim(),
      name: String(r.name ?? "").trim(),
      type: String(r.type ?? "").trim() as Task["type"],
      description: String(r.description ?? "").trim(),
      valueType: String(r.valueType ?? "").trim() as Task["valueType"],
      collectionType: String(r.collectionType ?? "").trim() as Task["collectionType"],
      frequency: String(r.frequency ?? "").trim() as Task["frequency"],
      adHocDate: r.adHocDate ? String(r.adHocDate).trim() : undefined,
      thresholdNumeric:
        numRaw === "" || numRaw === null || numRaw === undefined
          ? undefined
          : Number(numRaw),
      thresholdText: String(r.thresholdText ?? "").trim(),
      thresholdType: String(r.thresholdType ?? "").trim() as Task["thresholdType"],
      assignee: String(r.assignee ?? "").trim(),
      active: activeStr === "" ? true : ["true", "1", "yes", "y"].includes(activeRaw),
    };
    const { task, fieldErrors } = validateDraft(draft);
    if (task) valid.push(task);
    else drafts.push({ row: rowNum, draft, fieldErrors });
  });

  return { valid, drafts };
}
