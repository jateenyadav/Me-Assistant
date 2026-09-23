import { z } from "zod";

export const transactionCategories = ["food", "shopping", "transport", "bills", "health", "other"] as const;

export function parseRupeeAmount(value: string): number | null {
  const match = /^(0|[1-9]\d{0,8})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const amountMinor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return amountMinor > 0 ? amountMinor : null;
}

export const createTransactionSchema = z.strictObject({
  amountMinor: z.number().int().positive().max(100_000_000_000),
  type: z.enum(["expense", "income"]),
  category: z.enum(transactionCategories),
  note: z.string().trim().max(140).optional(),
  occurredAt: z.iso.datetime({ offset: true }),
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;

export interface PublicTransaction extends CreateTransactionDto {
  id: string;
  currency: "INR";
  source: "manual";
  createdAt: string;
}
