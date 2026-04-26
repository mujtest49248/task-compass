import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  taskSchema,
  type Task,
} from "@/lib/task-types";
import { taskStore } from "@/lib/task-store";

interface Props {
  initial?: Task;
  onDone: () => void;
}

export function TaskForm({ initial, onDone }: Props) {
  const [form, setForm] = useState<Partial<Task>>(
    initial ?? {
      taskId: "",
      name: "",
      type: "K",
      description: "",
      link: "",
      valueType: "Numeric",
      collectionType: "Manual",
      frequency: "Daily",
      thresholdType: undefined,
      thresholdText: "",
      assignee: "",
      active: true,
    },
  );

  const set = <K extends keyof Task>(k: K, v: Task[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = taskSchema.safeParse({
      ...form,
      thresholdNumeric:
        form.thresholdNumeric === undefined || Number.isNaN(form.thresholdNumeric)
          ? undefined
          : Number(form.thresholdNumeric),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (!initial && taskStore.get(parsed.data.taskId)) {
      toast.error("Task ID already exists");
      return;
    }
    taskStore.upsert(parsed.data);
    toast.success(initial ? "Task updated" : "Task created");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="taskId">Task ID</Label>
          <Input
            id="taskId"
            value={form.taskId ?? ""}
            disabled={!!initial}
            onChange={(e) => set("taskId", e.target.value)}
            placeholder="K-001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Task name</Label>
          <Input
            id="name"
            value={form.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Task type</Label>
          <Select value={form.type} onValueChange={(v) => set("type", v as Task["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Assignee</Label>
          <Input
            value={form.assignee ?? ""}
            onChange={(e) => set("assignee", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Value type</Label>
          <Select value={form.valueType} onValueChange={(v) => set("valueType", v as Task["valueType"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VALUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Collection type</Label>
          <Select value={form.collectionType} onValueChange={(v) => set("collectionType", v as Task["collectionType"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COLLECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select value={form.frequency} onValueChange={(v) => set("frequency", v as Task["frequency"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {form.frequency === "Ad-hoc" && (
          <div className="space-y-2">
            <Label>Ad-hoc date</Label>
            <Input
              type="date"
              value={form.adHocDate ?? ""}
              onChange={(e) => set("adHocDate", e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Threshold type</Label>
          <Select value={form.thresholdType} onValueChange={(v) => set("thresholdType", v as Task["thresholdType"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {THRESHOLD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Threshold (numeric)</Label>
          <Input
            type="number"
            value={form.thresholdNumeric ?? ""}
            onChange={(e) =>
              set("thresholdNumeric", e.target.value === "" ? (undefined as never) : Number(e.target.value))
            }
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Threshold (text)</Label>
          <Input
            value={form.thresholdText ?? ""}
            onChange={(e) => set("thresholdText", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div>
          <Label className="text-sm">Active</Label>
          <p className="text-xs text-muted-foreground">Inactive tasks are paused</p>
        </div>
        <Switch checked={!!form.active} onCheckedChange={(v) => set("active", v)} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit">{initial ? "Save changes" : "Create task"}</Button>
      </div>
    </form>
  );
}
