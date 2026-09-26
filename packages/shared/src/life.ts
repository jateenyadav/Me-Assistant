import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });
const quantity = z.number().finite().nonnegative().max(1_000_000);

export const foodLogSchema = z.strictObject({
  name: z.string().trim().min(1).max(180),
  servingGrams: quantity.positive().optional(),
  calories: quantity,
  proteinGrams: quantity,
  carbohydratesGrams: quantity,
  fatGrams: quantity,
  source: z.enum(["manual", "usda", "open_food_facts"]),
  externalId: z.string().trim().max(120).optional(),
  loggedAt: timestamp,
}).refine((food) => food.source === "manual" || food.servingGrams !== undefined, {
  path: ["servingGrams"], message: "Catalog food needs a serving weight",
});

export const workoutLogSchema = z.strictObject({
  title: z.string().trim().min(1).max(140),
  structure: z.enum(["straight", "superset", "circuit"]),
  exercises: z.array(z.strictObject({
    name: z.string().trim().min(1).max(140),
    sets: z.array(z.strictObject({
      reps: z.number().int().min(1).max(1000).optional(),
      weightKg: quantity.optional(),
      durationSeconds: z.number().int().min(1).max(86400).optional(),
    }).refine((set) => set.reps !== undefined || set.durationSeconds !== undefined)).min(1).max(100),
    restSeconds: z.number().int().min(0).max(3600).optional(),
  })).min(1).max(50),
  loggedAt: timestamp,
});

const timeZone = z.string().min(1).max(64).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Invalid IANA time zone");

export const medicationSchema = z.strictObject({
  name: z.string().trim().min(1).max(140),
  dose: z.string().trim().min(1).max(80),
  instructions: z.string().trim().max(500).optional(),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timeZone,
  recurrence: z.enum(["daily", "weekly"]),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
}).superRefine((value, context) => {
  if (value.recurrence === "weekly" && !value.weekdays?.length) {
    context.addIssue({ code: "custom", path: ["weekdays"], message: "Select at least one weekday" });
  }
  if (value.recurrence === "daily" && value.weekdays !== undefined) {
    context.addIssue({ code: "custom", path: ["weekdays"], message: "Weekdays are only for weekly schedules" });
  }
});

export const medicationIntakeSchema = z.strictObject({
  medicationId: z.string().regex(/^[a-f0-9]{24}$/),
  outcome: z.enum(["taken", "skipped"]),
  loggedAt: timestamp,
});

export const noteSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const reminderSchema = z.strictObject({
  title: z.string().trim().min(1).max(160),
  dueAt: timestamp,
  recurrence: z.enum(["none", "daily", "weekly", "yearly"]),
  timeZone,
});

export const goalSchema = z.strictObject({
  title: z.string().trim().min(1).max(160),
  horizon: z.enum(["short", "long"]),
  domain: z.enum(["finance", "diet", "workout", "medication", "custom"]),
  target: quantity.positive(),
  unit: z.string().trim().min(1).max(30),
  dueAt: timestamp.optional(),
});

export const lifeSchemas = {
  food: foodLogSchema,
  workout: workoutLogSchema,
  medication: medicationSchema,
  "medication-intake": medicationIntakeSchema,
  note: noteSchema,
  reminder: reminderSchema,
  goal: goalSchema,
};

export type LifeKind = keyof typeof lifeSchemas;
export type LifePayload = z.infer<(typeof lifeSchemas)[LifeKind]>;

export interface CatalogFood {
  id: string;
  name: string;
  source: "usda" | "open_food_facts";
  per100g: { calories: number | null; proteinGrams: number | null; carbohydratesGrams: number | null; fatGrams: number | null };
}

export interface CatalogExercise {
  id: number;
  name: string;
  category: string;
  equipment: string[];
}

export interface LifeEntry {
  id: string;
  kind: LifeKind;
  payload: LifePayload;
  createdAt: string;
  updatedAt: string;
}
