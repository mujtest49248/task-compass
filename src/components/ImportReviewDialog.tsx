import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_TYPES,
  VALUE_TYPES,
  COLLECTION_TYPES,
  FREQUENCIES,
  THRESHOLD_TYPES,
  type Task,
} from "@/lib/task-types";
import { validateDraftRow, type DraftRow, type DraftTask } from "@/lib/task-xlsx";

interface Props {
  open: boolean;
  drafts: DraftRow[];
  onCancel: () => void;
  onConfirm: (tasks: Task[]) => void;
}

type EditableField = Exclude<keyof Task, "taskId">;

const FIELDS: { key: EditableField; label: string; kind: "text" | "number" | "date" | "switch" | "select" | "url"; options?: readonly string[] }[] = [
  { key: "name", label: "Name", kind: "text" },
  { key: "type", label: "Type", kind: "select", options: TASK_TYPES },
  { key: "valueType", label: "Value type", kind: "select", options: VALUE_TYPES },
  { key: "collectionType", label: "Collection", kind: "select", options: COLLECTION_TYPES },
  { key: "frequency", label: "Frequency", kind: "select", options: FREQUENCIES },
  { key: "adHocDate", label: "Ad-hoc date", kind: "date" },
  { key: "thresholdType", label: "Threshold type (optional)", kind: "select", options: THRESHOLD_TYPES },
  { key: "thresholdNumeric", label: "Threshold (numeric, optional)", kind: "number" },
  { key: "thresholdText", label: "Threshold (text, optional)", kind: "text" },
  { key: "assignee", label: "Assignee", kind: "text" },
  { key: "link", label: "Link (optional)", kind: "url" },
  { key: "description", label: "Description", kind: "text" },
  { key: "active", label: "Active", kind: "switch" },
];

export function ImportReviewDialog({ open, drafts: initial, onCancel, onConfirm }: Props) {
  const [drafts, setDrafts] = useState<DraftRow[]>(initial);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initial.map((d) => d.row)));
  const [bulkField, setBulkField] = useState<EditableField>("assignee");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [bulkOnlyMissing, setBulkOnlyMissing] = useState(true);

  // Re-sync when prop changes (new import)
  useMemo(() => {
    setDrafts(initial);
    setSelected(new Set(initial.map((d) => d.row)));
    setExpanded(new Set());
  }, [initial]);

  const updateDraft = (row: number, patch: Partial<DraftTask>) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.row !== row) return d;
        const nextDraft = { ...d.draft, ...patch };
        const { fieldErrors } = validateDraftRow(nextDraft);
        return { ...d, draft: nextDraft, fieldErrors };
      }),
    );
  };

  const toggleExpand = (row: number) => {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(row)) n.delete(row);
      else n.add(row);
      return n;
    });
  };

  const toggleSelect = (row: number) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(row)) n.delete(row);
      else n.add(row);
      return n;
    });
  };

  const validRows = useMemo(
    () => drafts.filter((d) => Object.keys(d.fieldErrors).length === 0),
    [drafts],
  );
  const selectedValidTasks = useMemo(
    () => validRows.filter((d) => selected.has(d.row)).map((d) => d.draft as Task),
    [validRows, selected],
  );

  const fieldDef = FIELDS.find((f) => f.key === bulkField)!;

  const applyBulk = () => {
    let parsed: unknown = bulkValue;
    if (fieldDef.kind === "number") {
      parsed = bulkValue === "" ? undefined : Number(bulkValue);
    } else if (fieldDef.kind === "switch") {
      parsed = bulkValue === "true";
    }
    setDrafts((prev) =>
      prev.map((d) => {
        if (!selected.has(d.row)) return d;
        if (bulkOnlyMissing) {
          const cur = d.draft[bulkField];
          const isEmpty =
            cur === undefined || cur === null || cur === "" || (typeof cur === "number" && Number.isNaN(cur));
          if (!isEmpty && !d.fieldErrors[bulkField]) return d;
        }
        const nextDraft = { ...d.draft, [bulkField]: parsed as never };
        const { fieldErrors } = validateDraftRow(nextDraft);
        return { ...d, draft: nextDraft, fieldErrors };
      }),
    );
  };

  const renderEditor = (d: DraftRow, field: typeof FIELDS[number]) => {
    const value = d.draft[field.key];
    const err = d.fieldErrors[field.key];
    const onText = (v: string) => updateDraft(d.row, { [field.key]: v } as Partial<DraftTask>);
    const common = err ? "border-destructive" : "";
    if (field.kind === "select") {
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Select value={(value as string) || ""} onValueChange={onText}>
            <SelectTrigger className={common}>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {field.options!.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      );
    }
    if (field.kind === "switch") {
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <div className="flex h-9 items-center">
            <Switch
              checked={!!value}
              onCheckedChange={(v) => updateDraft(d.row, { active: v })}
            />
          </div>
        </div>
      );
    }
    if (field.kind === "number") {
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Input
            type="number"
            className={common}
            value={value === undefined || value === null || Number.isNaN(value as number) ? "" : String(value)}
            onChange={(e) =>
              updateDraft(d.row, {
                thresholdNumeric: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <Label className="text-xs">{field.label}</Label>
        <Input
          type={field.kind === "date" ? "date" : field.kind === "url" ? "url" : "text"}
          className={common}
          value={(value as string) ?? ""}
          onChange={(e) => onText(e.target.value)}
        />
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review {drafts.length} row(s) with missing or invalid values</DialogTitle>
          <DialogDescription>
            Fix values in bulk or expand a row to edit it individually. Only rows with no errors will be imported.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wand2 className="h-4 w-4" /> Bulk fill
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Field</Label>
              <Select value={bulkField} onValueChange={(v) => { setBulkField(v as EditableField); setBulkValue(""); }}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-48">
              <Label className="text-xs">Value</Label>
              {fieldDef.kind === "select" ? (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {fieldDef.options!.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : fieldDef.kind === "switch" ? (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={fieldDef.kind === "number" ? "number" : fieldDef.kind === "date" ? "date" : "text"}
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="only-missing"
                checked={bulkOnlyMissing}
                onCheckedChange={(v) => setBulkOnlyMissing(v === true)}
              />
              <Label htmlFor="only-missing" className="text-xs">Only empty/invalid</Label>
            </div>
            <Button type="button" size="sm" onClick={applyBulk}>
              Apply to {selected.size} selected
            </Button>
          </div>
        </div>

        <div className="rounded-lg border divide-y">
          {drafts.map((d) => {
            const errCount = Object.keys(d.fieldErrors).length;
            const isOpen = expanded.has(d.row);
            const isSelected = selected.has(d.row);
            return (
              <div key={d.row} className="bg-card">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(d.row)}
                    aria-label={`Select row ${d.row}`}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpand(d.row)}>
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                  <span className="text-xs text-muted-foreground w-14">Row {d.row}</span>
                  <span className="font-mono text-xs">{d.draft.taskId || <em className="text-destructive">no id</em>}</span>
                  <span className="font-medium truncate max-w-xs">{d.draft.name || <em className="text-muted-foreground">unnamed</em>}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {errCount > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />{errCount} issue{errCount > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Ready</Badge>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="grid grid-cols-1 gap-3 border-t bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Task ID</Label>
                      <Input
                        className={d.fieldErrors.taskId ? "border-destructive" : ""}
                        value={d.draft.taskId ?? ""}
                        onChange={(e) => updateDraft(d.row, { taskId: e.target.value })}
                      />
                      {d.fieldErrors.taskId && <p className="text-xs text-destructive">{d.fieldErrors.taskId}</p>}
                    </div>
                    {FIELDS.map((f) => (
                      <div key={f.key}>{renderEditor(d, f)}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <div className="mr-auto text-sm text-muted-foreground">
            {selectedValidTasks.length} of {selected.size} selected ready to import
          </div>
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />Cancel
          </Button>
          <Button
            disabled={selectedValidTasks.length === 0}
            onClick={() => onConfirm(selectedValidTasks)}
          >
            Import {selectedValidTasks.length} task(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
