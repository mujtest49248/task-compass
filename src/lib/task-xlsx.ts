import * as XLSX from "xlsx";
import { taskSchema, type Task } from "./task-types";

const HEADERS = [
  "taskId",
  "name",
  "type",
  "description",
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
    valueType: t.valueType,
    collectionType: t.collectionType,
    frequency: t.frequency,
    adHocDate: t.adHocDate ?? "",
    thresholdNumeric: t.thresholdNumeric ?? "",
    thresholdText: t.thresholdText ?? "",
    thresholdType: t.thresholdType,
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

export interface ImportResult {
  valid: Task[];
  errors: { row: number; message: string }[];
}

export async function parseTasksFromFile(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const valid: Task[] = [];
  const errors: ImportResult["errors"] = [];

  raw.forEach((r, i) => {
    const rowNum = i + 2; // header is row 1
    const activeRaw = String(r.active ?? "").trim().toLowerCase();
    const numRaw = r.thresholdNumeric;
    const candidate = {
      taskId: String(r.taskId ?? "").trim(),
      name: String(r.name ?? "").trim(),
      type: String(r.type ?? "").trim(),
      description: String(r.description ?? "").trim(),
      valueType: String(r.valueType ?? "").trim(),
      collectionType: String(r.collectionType ?? "").trim(),
      frequency: String(r.frequency ?? "").trim(),
      adHocDate: r.adHocDate ? String(r.adHocDate).trim() : undefined,
      thresholdNumeric:
        numRaw === "" || numRaw === null || numRaw === undefined
          ? undefined
          : Number(numRaw),
      thresholdText: String(r.thresholdText ?? "").trim(),
      thresholdType: String(r.thresholdType ?? "").trim(),
      assignee: String(r.assignee ?? "").trim(),
      active: ["true", "1", "yes", "y"].includes(activeRaw),
    };
    const parsed = taskSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({ row: rowNum, message: parsed.error.issues[0]?.message ?? "Invalid row" });
    } else {
      valid.push(parsed.data);
    }
  });

  return { valid, errors };
}
