import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { taskStore } from "@/lib/task-store";

interface Props {
  ids: string[];
  onDone: () => void;
}

type BulkFields = {
  type: boolean;
  valueType: boolean;
  collectionType: boolean;
  frequency: boolean;
  thresholdType: boolean;
  thresholdNumeric: boolean;
  thresholdText: boolean;
  assignee: boolean;
  active: boolean;
  link: boolean;
};

function FieldRow({
  field,
  label,
  enabled,
  onToggle,
  children,
}: {
  field: keyof BulkFields;
  label: string;
  enabled: boolean;
  onToggle: (field: keyof BulkFields) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Checkbox
        checked={enabled}
        onCheckedChange={() => onToggle(field)}
        className="mt-2"
        aria-label={`Enable ${label}`}
      />
      <div className="flex-1 space-y-2">
        <Label className="text-sm">{label}</Label>
        <div className={enabled ? "" : "pointer-events-none opacity-50"}>{children}</div>
      </div>
    </div>
  );
}

export function BulkEditForm({ ids, onDone }: Props) {
  const [enabled, setEnabled] = useState<BulkFields>({
    type: false,
    valueType: false,
    collectionType: false,
    frequency: false,
    thresholdType: false,
    thresholdNumeric: false,
    thresholdText: false,
    assignee: false,
    active: false,
    link: false,
  });
  const [values, setValues] = useState<Partial<Task>>({
    type: "K",
    valueType: "Numeric",
    collectionType: "Manual",
    frequency: "Daily",
    thresholdType: undefined,
    thresholdNumeric: undefined,
    thresholdText: "",
    assignee: "",
    active: true,
    link: "",
  });

  const toggle = (k: keyof BulkFields) => setEnabled((p) => ({ ...p, [k]: !p[k] }));
  const set = <K extends keyof Task>(k: K, v: Task[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const patch: Partial<Task> = {};
    (Object.keys(enabled) as (keyof BulkFields)[]).forEach((k) => {
      if (enabled[k]) (patch as Record<string, unknown>)[k] = values[k];
    });
    if (Object.keys(patch).length === 0) {
      toast.error("Select at least one field to update");
      return;
    }
    try {
      await taskStore.updateMany(ids, patch);
      toast.success(`Updated ${ids.length} task(s)`);
      onDone();
    } catch {
      toast.error("Failed to update tasks");
    }
  };

  const Row = ({
    field,
    label,
    children,
  }: {
    field: keyof BulkFields;
    label: string;
    children: React.ReactNode;
  }) => (
    <FieldRow field={field} label={label} enabled={enabled[field]} onToggle={toggle}>
      {children}
    </FieldRow>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tick a field to apply its value to all {ids.length} selected task(s). Unticked fields stay unchanged.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Row field="type" label="Task type">
          <Select value={values.type} onValueChange={(v) => set("type", v as Task["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>

        <Row field="assignee" label="Assignee">
          <Input value={values.assignee ?? ""} onChange={(e) => set("assignee", e.target.value)} />
        </Row>

        <Row field="valueType" label="Value type">
          <Select value={values.valueType} onValueChange={(v) => set("valueType", v as Task["valueType"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VALUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>

        <Row field="collectionType" label="Collection type">
          <Select value={values.collectionType} onValueChange={(v) => set("collectionType", v as Task["collectionType"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COLLECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>

        <Row field="frequency" label="Frequency">
          <Select value={values.frequency} onValueChange={(v) => set("frequency", v as Task["frequency"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>

        <Row field="thresholdType" label="Threshold type">
          <Select
            value={values.thresholdType ?? "__none"}
            onValueChange={(v) =>
              set("thresholdType", v === "__none" ? (undefined as never) : (v as Task["thresholdType"]))
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None</SelectItem>
              {THRESHOLD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>

        <Row field="thresholdNumeric" label="Threshold (numeric)">
          <Input
            type="number"
            value={values.thresholdNumeric ?? ""}
            onChange={(e) =>
              set("thresholdNumeric", e.target.value === "" ? (undefined as never) : Number(e.target.value))
            }
          />
        </Row>

        <Row field="thresholdText" label="Threshold (text)">
          <Input
            value={values.thresholdText ?? ""}
            onChange={(e) => set("thresholdText", e.target.value)}
          />
        </Row>

        <Row field="link" label="Link">
          <Input
            type="url"
            placeholder="https://…"
            value={values.link ?? ""}
            onChange={(e) => set("link", e.target.value)}
          />
        </Row>

        <Row field="active" label="Active">
          <div className="flex items-center gap-3">
            <Switch checked={!!values.active} onCheckedChange={(v) => set("active", v)} />
            <span className="text-sm text-muted-foreground">
              {values.active ? "Activate" : "Deactivate"}
            </span>
          </div>
        </Row>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit">Apply to {ids.length} task(s)</Button>
      </div>
    </form>
  );
}
