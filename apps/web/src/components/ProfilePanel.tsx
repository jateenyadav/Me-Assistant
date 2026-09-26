"use client";

import { useState, type FormEvent } from "react";
import { updateProfileSchema, type PublicUser } from "@lifeos/shared";
import { authenticatedFetch } from "@/lib/auth";

export function ProfilePanel({ user, onUpdate }: { user: PublicUser; onUpdate: (next: PublicUser) => void }) {
  const [height, setHeight] = useState(user.profile.heightCm?.toString() ?? "");
  const [weight, setWeight] = useState(user.profile.weightKg?.toString() ?? "");
  const [goal, setGoal] = useState(user.profile.goal ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = updateProfileSchema.safeParse({
      heightCm: height ? Number(height) : undefined,
      weightKg: weight ? Number(weight) : undefined,
      goal: goal.trim(),
    });
    if (!result.success) { setMessage(result.error.issues[0]?.message ?? "Invalid profile"); return; }
    setBusy(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/auth/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data),
      });
      if (!response.ok) throw new Error(`Profile update failed (${response.status})`);
      const body = (await response.json()) as { user: PublicUser };
      onUpdate(body.user);
      setMessage("Profile saved.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not save profile"); }
    finally { setBusy(false); }
  }

  return <section className="card" aria-labelledby="profile-heading">
    <h2 id="profile-heading">Your profile</h2>
    <p className="muted">Optional measurements and priorities you provide. LifeOS does not infer or prescribe them.</p>
    <form onSubmit={save}>
      <div className="finance-fields">
        <div><label htmlFor="profile-height">Height (cm)</label><input id="profile-height" type="number" min="50" max="280" step="any" value={height} onChange={(event) => setHeight(event.target.value)} /></div>
        <div><label htmlFor="profile-weight">Weight (kg)</label><input id="profile-weight" type="number" min="10" max="500" step="any" value={weight} onChange={(event) => setWeight(event.target.value)} /></div>
      </div>
      <label htmlFor="profile-goal">Personal priority</label><input id="profile-goal" maxLength={500} value={goal} onChange={(event) => setGoal(event.target.value)} />
      <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </section>;
}
