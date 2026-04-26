import { z } from "zod";

export const TASK_TYPES = ["K", "R", "O"] as const;
export const VALUE_TYPES = ["Numeric", "String", "Other"] as const;
export const COLLECTION_TYPES = ["Manual", "Auto"] as const;
export const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly", "Ad-hoc"] as const;
export const THRESHOLD_TYPES = ["MIN", "MAX", "Exact"] as const;

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .refine(
    (v) => !v || /^(https?:\/\/|\/|mailto:|tel:)/i.test(v),
    { message: "Must be a valid URL" },
  );

export const taskSchema = z
  .object({
    taskId: z.string().trim().min(1, "Task ID is required").max(64),
    name: z.string().trim().min(1, "Name is required").max(200),
    type: z.enum(TASK_TYPES),
    description: z.string().trim().max(2000).optional().default(""),
    link: optionalUrl,
    valueType: z.enum(VALUE_TYPES),
    collectionType: z.enum(COLLECTION_TYPES),
    frequency: z.enum(FREQUENCIES),
    adHocDate: z.string().optional(),
    thresholdNumeric: z.union([z.number(), z.nan()]).optional(),
    thresholdText: z.string().trim().max(200).optional().default(""),
    thresholdType: z.enum(THRESHOLD_TYPES).optional(),
    assignee: z.string().trim().min(1, "Assignee is required").max(120),
    active: z.boolean(),
  })
  .refine((d) => d.frequency !== "Ad-hoc" || (d.adHocDate && d.adHocDate.length > 0), {
    message: "Ad-hoc date is required",
    path: ["adHocDate"],
  });

export type Task = z.infer<typeof taskSchema>;
