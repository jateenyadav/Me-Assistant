"use client";

import { useEffect, useState, type FormEvent } from "react";
import { lifeSchemas, type CatalogExercise, type CatalogFood, type LifeEntry, type LifeKind } from "@lifeos/shared";
import { authenticatedFetch } from "@/lib/auth";

type FormKind = Exclude<LifeKind, "medication-intake">;
type Field = { key: string; label: string; type?: "number" | "date" | "time" | "textarea"; options?: string[]; optional?: boolean };

const labels: Record<FormKind, string> = {
  food: "Food", workout: "Workouts", medication: "Medication", note: "Notes", reminder: "Reminders", goal: "Goals",
};
const kinds = Object.keys(labels) as FormKind[];
const fields: Record<FormKind, Field[]> = {
  food: [
    { key: "name", label: "Food name" }, { key: "servingGrams", label: "Serving (grams)", type: "number", optional: true },
    { key: "calories", label: "Calories for serving (manual) or per 100g (catalog)", type: "number" },
    { key: "proteinGrams", label: "Protein (g)", type: "number" },
    { key: "carbohydratesGrams", label: "Carbohydrates (g)", type: "number" },
    { key: "fatGrams", label: "Fat (g)", type: "number" },
  ],
  workout: [
    { key: "title", label: "Workout name" },
    { key: "structure", label: "Structure", options: ["straight", "superset", "circuit"] },
    { key: "exerciseLines", label: "Exercises: one per line (name | repetitions | weight in kg)", type: "textarea" },
    { key: "setCount", label: "Sets per exercise", type: "number" },
    { key: "restSeconds", label: "Rest between sets (seconds)", type: "number", optional: true },
  ],
  medication: [
    { key: "name", label: "Medication name" }, { key: "dose", label: "Prescribed dose (your own entry)" },
    { key: "instructions", label: "Instructions (optional)", optional: true },
    { key: "timeOfDay", label: "Time of day", type: "time" },
    { key: "timeZone", label: "IANA time zone" },
    { key: "recurrence", label: "Repeat", options: ["daily", "weekly"] },
    { key: "weekdays", label: "Weekdays for weekly schedule (0=Sun, 1=Mon, …, 6=Sat)", optional: true },
  ],
  note: [{ key: "title", label: "Title" }, { key: "body", label: "Note", type: "textarea" }, { key: "tags", label: "Tags (comma-separated)", optional: true }],
  reminder: [
    { key: "title", label: "What should you remember?" }, { key: "dueAt", label: "Date and time", type: "date" },
    { key: "recurrence", label: "Repeat", options: ["none", "daily", "weekly", "yearly"] },
    { key: "timeZone", label: "IANA time zone" },
  ],
  goal: [
    { key: "title", label: "Goal" }, { key: "horizon", label: "Time horizon", options: ["short", "long"] },
    { key: "domain", label: "Area", options: ["finance", "diet", "workout", "medication", "custom"] },
    { key: "target", label: "Target value", type: "number" }, { key: "unit", label: "Unit (e.g. kg, ₹, sessions)" },
    { key: "dueAt", label: "Target date (optional)", type: "date", optional: true },
  ],
};

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function initialDraft(): Record<string, string> {
  return {
    source: "manual", structure: "straight", setCount: "1", recurrence: "none",
    timeOfDay: "08:00", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    horizon: "short", domain: "custom", dueAt: "",
  };
}

function asIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function payloadFor(kind: FormKind, draft: Record<string, string>): unknown {
  const number = (key: string) => draft[key] === undefined || draft[key] === "" ? NaN : Number(draft[key]);
  switch (kind) {
    case "food": {
      const servingGrams = draft.servingGrams ? number("servingGrams") : undefined;
      const ratio = draft.source !== "manual" && draft.nutritionIsServing !== "yes" && servingGrams ? servingGrams / 100 : 1;
      const scaled = (key: string) => Math.round(number(key) * ratio * 100) / 100;
      return {
        name: draft.name, servingGrams, calories: scaled("calories"), proteinGrams: scaled("proteinGrams"),
        carbohydratesGrams: scaled("carbohydratesGrams"), fatGrams: scaled("fatGrams"),
        source: draft.source || "manual", externalId: draft.externalId || undefined,
        loggedAt: draft.loggedAt || new Date().toISOString(),
      };
    }
    case "workout": {
      const count = number("setCount");
      const exercises = (draft.exerciseLines ?? "").split("\n").filter((line) => line.trim()).map((line) => {
        const [name, reps, weightKg] = line.split("|").map((part) => part.trim());
        const set = { reps: Number(reps), weightKg: weightKg ? Number(weightKg) : undefined };
        return { name, sets: Array.from({ length: Number.isInteger(count) && count >= 1 && count <= 100 ? count : 0 }, () => ({ ...set })),
          restSeconds: draft.restSeconds ? number("restSeconds") : undefined };
      });
      const original = draft.originalExercises && draft.exerciseLines === draft.initialExerciseLines
        ? JSON.parse(draft.originalExercises) as unknown : exercises;
      return { title: draft.title, structure: draft.structure || "straight", exercises: original, loggedAt: draft.loggedAt || new Date().toISOString() };
    }
    case "medication": return {
      name: draft.name, dose: draft.dose, instructions: draft.instructions || undefined,
      timeOfDay: draft.timeOfDay, timeZone: draft.timeZone, recurrence: draft.recurrence || "daily",
      weekdays: draft.recurrence === "weekly" ? (draft.weekdays ?? "").split(",").map((day) => day.trim()).filter(Boolean).map(Number) : undefined,
    };
    case "note": return { title: draft.title, body: draft.body, tags: (draft.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean) };
    case "reminder": return { title: draft.title, dueAt: asIso(draft.dueAt), recurrence: draft.recurrence || "none", timeZone: draft.timeZone };
    case "goal": return {
      title: draft.title, horizon: draft.horizon || "short", domain: draft.domain || "custom",
      target: number("target"), unit: draft.unit, dueAt: draft.dueAt ? asIso(draft.dueAt) : undefined,
    };
  }
}

function draftFor(entry: LifeEntry): Record<string, string> {
  const payload = entry.payload as Record<string, unknown>;
  const draft = initialDraft();
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number") draft[key] = String(value);
  }
  if (entry.kind === "note" && Array.isArray(payload.tags)) draft.tags = payload.tags.join(", ");
  if (entry.kind === "medication" && Array.isArray(payload.weekdays)) draft.weekdays = payload.weekdays.join(",");
  if (entry.kind === "workout" && Array.isArray(payload.exercises)) {
    const exercises = payload.exercises as { name: string; sets: { reps?: number; weightKg?: number }[]; restSeconds?: number }[];
    draft.exerciseLines = exercises.map((exercise) => `${exercise.name} | ${exercise.sets[0]?.reps ?? ""} | ${exercise.sets[0]?.weightKg ?? ""}`).join("\n");
    draft.initialExerciseLines = draft.exerciseLines;
    draft.originalExercises = JSON.stringify(payload.exercises);
    draft.setCount = String(exercises[0]?.sets.length ?? 1);
    draft.restSeconds = String(exercises[0]?.restSeconds ?? "");
  }
  if (entry.kind === "food" && payload.source !== "manual") draft.nutritionIsServing = "yes";
  if (typeof payload.dueAt === "string") draft.dueAt = localDateTime(new Date(payload.dueAt));
  return draft;
}

async function messageFor(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as { message?: string | { message?: string } };
  return typeof body.message === "string" ? body.message : `Request failed (${response.status})`;
}

export function LifeHub() {
  const [kind, setKind] = useState<FormKind>("food");
  const [draft, setDraft] = useState<Record<string, string>>(initialDraft);
  const [entries, setEntries] = useState<LifeEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [foodQuery, setFoodQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [foods, setFoods] = useState<CatalogFood[]>([]);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [goalProgress, setGoalProgress] = useState<Record<string, { current: number | null; target: number; unit: string }>>({});
  const [foodSummary, setFoodSummary] = useState<{
    count: number; calories: number; proteinGrams: number; carbohydratesGrams: number; fatGrams: number;
  } | null>(null);
  const [workoutStats, setWorkoutStats] = useState<{
    exercise: string; sets: number; heaviestKg: number; volumeKg: number;
  }[]>([]);
  const [restRemaining, setRestRemaining] = useState(0);

  useEffect(() => {
    if (restRemaining <= 0) return;
    const timer = window.setTimeout(() => setRestRemaining((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [restRemaining]);

  useEffect(() => {
    let active = true;
    authenticatedFetch(`/life/${kind}`).then(async (response) => {
      if (!response.ok) throw new Error(await messageFor(response));
      return (await response.json()) as { entries: LifeEntry[] };
    }).then((result) => { if (active) setEntries(result.entries); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load records"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind]);

  useEffect(() => {
    if (kind !== "goal") return;
    let active = true;
    authenticatedFetch("/life/goals/progress").then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load goal progress")))
      .then((body: { progress: { goalId: string; current: number | null; target: number; unit: string }[] }) => {
        if (active) setGoalProgress(Object.fromEntries(body.progress.map((item) => [item.goalId, item])));
      }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load goal progress"); });
    return () => { active = false; };
  }, [kind, entries]);

  useEffect(() => {
    if (kind !== "food") return;
    let active = true;
    authenticatedFetch("/life/food/summary")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load food summary")))
      .then((body: { summary: NonNullable<typeof foodSummary> }) => { if (active) setFoodSummary(body.summary); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load food summary"); });
    return () => { active = false; };
  }, [kind, entries]);

  useEffect(() => {
    if (kind !== "workout") return;
    let active = true;
    authenticatedFetch("/life/workout/stats")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load workout stats")))
      .then((body: { exercises: typeof workoutStats }) => { if (active) setWorkoutStats(body.exercises); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load workout stats"); });
    return () => { active = false; };
  }, [kind, entries]);

  function switchKind(next: FormKind) {
    setKind(next);
    setEntries([]);
    setDraft({ ...initialDraft(), recurrence: next === "medication" ? "daily" : "none",
      dueAt: next === "reminder" ? localDateTime(new Date(Date.now() + 86_400_000)) : "" });
    setEditingId(null);
    setError(null);
    setNotice(null);
    setLoading(true);
    setFoods([]);
    setExercises([]);
  }

  async function reload() {
    const response = await authenticatedFetch(`/life/${kind}`);
    if (!response.ok) throw new Error(await messageFor(response));
    const body = (await response.json()) as { entries: LifeEntry[] };
    setEntries(body.entries);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const result = lifeSchemas[kind].safeParse(payloadFor(kind, draft));
    if (!result.success) {
      setError(`${result.error.issues[0]?.path.join(".") || "Record"}: ${result.error.issues[0]?.message || "Invalid input"}`);
      return;
    }
    setSaving(true);
    try {
      const response = await authenticatedFetch(`/life/${kind}${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data),
      });
      if (!response.ok) throw new Error(await messageFor(response));
      await reload();
      setDraft({ ...initialDraft(), recurrence: kind === "medication" ? "daily" : "none",
        dueAt: kind === "reminder" ? localDateTime(new Date(Date.now() + 86_400_000)) : "" });
      setEditingId(null);
      setNotice("Saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save record");
    } finally { setSaving(false); }
  }

  async function remove(entry: LifeEntry) {
    if (!window.confirm(`Delete this ${kind} record? This cannot be undone.`)) return;
    setError(null);
    try {
      const response = await authenticatedFetch(`/life/${kind}/${entry.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await messageFor(response));
      await reload();
      if (editingId === entry.id) setEditingId(null);
      setNotice("Deleted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete record"); }
  }

  async function intake(medicationId: string, outcome: "taken" | "skipped") {
    setError(null);
    try {
      const response = await authenticatedFetch("/life/medication-intake", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicationId, outcome, loggedAt: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(await messageFor(response));
      setNotice(`Medication marked ${outcome}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not log intake"); }
  }

  async function lookup(mode: "search" | "barcode") {
    setError(null);
    setFoods([]);
    try {
      const path = mode === "search" ? `/catalog/foods?q=${encodeURIComponent(foodQuery)}` : `/catalog/barcode/${encodeURIComponent(barcode)}`;
      const response = await authenticatedFetch(path);
      if (!response.ok) throw new Error(await messageFor(response));
      const body = (await response.json()) as { foods?: CatalogFood[]; food?: CatalogFood | null };
      setFoods(mode === "search" ? body.foods ?? [] : body.food ? [body.food] : []);
      if (mode === "barcode" && !body.food) setNotice("Barcode not found. Enter this food manually.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Food lookup failed"); }
  }

  function chooseFood(food: CatalogFood) {
    setDraft((previous) => ({
      ...previous, name: food.name, source: food.source, externalId: food.id, servingGrams: "100", nutritionIsServing: "no",
      calories: food.per100g.calories?.toString() ?? "",
      proteinGrams: food.per100g.proteinGrams?.toString() ?? "",
      carbohydratesGrams: food.per100g.carbohydratesGrams?.toString() ?? "",
      fatGrams: food.per100g.fatGrams?.toString() ?? "",
    }));
    setNotice("Catalog values are per 100g; missing values must be entered before logging.");
  }

  async function lookupExercises() {
    setError(null);
    setExercises([]);
    try {
      const response = await authenticatedFetch(`/catalog/exercises?q=${encodeURIComponent(exerciseQuery)}`);
      if (!response.ok) throw new Error(await messageFor(response));
      const body = (await response.json()) as { exercises: CatalogExercise[] };
      setExercises(body.exercises);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Exercise lookup failed"); }
  }

  return (
    <section className="card life-card" aria-labelledby="life-heading">
      <h2 id="life-heading">Your life log</h2>
      <div className="life-tabs" role="group" aria-label="Life module">
        {kinds.map((item) => <button key={item} type="button" className={item === kind ? "selected" : ""} onClick={() => switchKind(item)}>{labels[item]}</button>)}
      </div>
      {kind === "food" && <div className="life-catalog">
        {foodSummary && <p className="muted">Last 30 days · {foodSummary.count} foods · {foodSummary.calories} kcal ·
          Protein {foodSummary.proteinGrams}g · Carbs {foodSummary.carbohydratesGrams}g · Fat {foodSummary.fatGrams}g</p>}
        <h3>Find food</h3>
        <p className="muted">Search USDA foods or look up a packaged food by barcode. A lookup is not a camera scan.</p>
        <div className="life-inline"><input aria-label="Food search" value={foodQuery} onChange={(event) => setFoodQuery(event.target.value)} placeholder="Search foods" />
          <button type="button" onClick={() => lookup("search")}>Search</button></div>
        <div className="life-inline"><input aria-label="Barcode number" value={barcode} onChange={(event) => setBarcode(event.target.value)} inputMode="numeric" placeholder="Barcode number" />
          <button type="button" onClick={() => lookup("barcode")}>Look up</button></div>
        {foods.length > 0 && <ul className="life-results">{foods.map((food) => <li key={`${food.source}:${food.id}`}>
          {food.name} · {food.source.replaceAll("_", " ")}
          <button type="button" onClick={() => chooseFood(food)}>Use</button>
        </li>)}</ul>}
      </div>}
      {kind === "workout" && <div className="life-catalog">
        {workoutStats.length > 0 && <><h3>Exercise progress</h3><ul className="life-results">{workoutStats.map((stat) =>
          <li key={stat.exercise}>{stat.exercise} · {stat.sets} sets · Heaviest logged {stat.heaviestKg}kg · Total volume {stat.volumeKg}kg</li>)}</ul>
          <p className="muted">Volume = logged repetitions × weight; bodyweight and time-only sets contribute zero.</p></>}
        <h3>Find exercises</h3>
        <p className="muted">Exercise names and equipment from the wger community catalog.</p>
        <div className="life-inline"><input aria-label="Exercise search" value={exerciseQuery} onChange={(event) => setExerciseQuery(event.target.value)} placeholder="Search exercise names" />
          <button type="button" onClick={lookupExercises}>Search</button></div>
        {exercises.length > 0 && <ul className="life-results">{exercises.map((exercise) => <li key={exercise.id}>
          {exercise.name} · {exercise.category} · {exercise.equipment.join(", ") || "No equipment"}
          <button type="button" onClick={() => setDraft((previous) => ({ ...previous,
            exerciseLines: `${previous.exerciseLines ? `${previous.exerciseLines}\n` : ""}${exercise.name} | 8 | 0`,
          }))}>Add</button>
        </li>)}</ul>}
      </div>}
      <form onSubmit={save}>
        <h3>{editingId ? `Edit ${labels[kind]}` : `Add ${labels[kind]}`}</h3>
        {fields[kind].map((field) => <div key={field.key}>
          <label htmlFor={`life-${field.key}`}>{field.label}</label>
          {field.options ? (
            <select id={`life-${field.key}`} value={draft[field.key] ?? field.options[0]} onChange={(event) => setDraft((old) => ({ ...old, [field.key]: event.target.value }))}>
              {field.options.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          ) : field.type === "textarea" ? (
            <textarea id={`life-${field.key}`} value={draft[field.key] ?? ""} onChange={(event) => setDraft((old) => ({ ...old, [field.key]: event.target.value }))} rows={4} required={!field.optional} />
          ) : (
            <input id={`life-${field.key}`} type={field.type === "date" ? "datetime-local" : field.type === "number" ? "number" : field.type ?? "text"}
              step={field.type === "number" ? "any" : undefined} min={field.type === "number" ? "0" : undefined}
              value={draft[field.key] ?? ""} onChange={(event) => setDraft((old) => ({ ...old, [field.key]: event.target.value }))} required={!field.optional} />
          )}
        </div>)}
        {kind === "medication" && <p className="muted">LifeOS records only the schedule and dose you enter. It does not prescribe or change doses.</p>}
        {kind === "workout" && <div className="life-inline">
          <button type="button" onClick={() => setRestRemaining(Number(draft.restSeconds) || 60)} disabled={restRemaining > 0}>Start rest timer</button>
          <span role="timer">{restRemaining > 0 ? `${restRemaining}s remaining` : "Timer stopped"}</span>
        </div>}
        {error && <p role="alert" className="error">{error}</p>}
        {notice && <p role="status" className="muted">{notice}</p>}
        <button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add entry"}</button>
        {editingId && <button type="button" className="life-secondary" onClick={() => { setEditingId(null); setDraft(initialDraft()); }}>Cancel editing</button>}
      </form>
      <h3>Recent {labels[kind].toLowerCase()}</h3>
      {loading ? <p className="muted">Loading…</p> : entries.length === 0 ? <p className="muted">No entries yet.</p> : (
        <ul className="life-results">{entries.map((entry) => {
          const payload = entry.payload as Record<string, unknown>;
          return <li key={entry.id}>
            <div><strong>{String(payload.title ?? payload.name ?? "Entry")}</strong>
              {kind === "medication" && <span className="muted">{String(payload.dose)} · {String(payload.timeOfDay)} ({String(payload.timeZone)})</span>}
              {kind === "food" && <span className="muted">{String(payload.calories)} kcal</span>}
              {kind === "reminder" && <span className="muted">{new Date(String(payload.dueAt)).toLocaleString()} · {String(payload.recurrence)}</span>}
              {kind === "goal" && <span className="muted">{goalProgress[entry.id]?.current === null || goalProgress[entry.id] === undefined
                ? "Progress not measured for this unit" : `${goalProgress[entry.id].current} / ${goalProgress[entry.id].target} ${goalProgress[entry.id].unit}`}</span>}
            </div>
            <div className="life-actions">
              <button type="button" onClick={() => { setEditingId(entry.id); setDraft(draftFor(entry)); }}>Edit</button>
              <button type="button" onClick={() => remove(entry)}>Delete</button>
              {kind === "medication" && <><button type="button" onClick={() => intake(entry.id, "taken")}>Taken</button>
                <button type="button" onClick={() => intake(entry.id, "skipped")}>Skipped</button></>}
            </div>
          </li>;
        })}</ul>
      )}
    </section>
  );
}
