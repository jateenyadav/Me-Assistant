/** Parse a short duration string like "15m", "7d", "30s", "12h" into milliseconds. */
export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: "${input}" (use e.g. 15m, 7d)`);
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return value * unitMs[unit as keyof typeof unitMs];
}
