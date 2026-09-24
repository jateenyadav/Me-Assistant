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

export const importNotificationSchema = z.strictObject({
  eventId: z.string().regex(/^[a-f0-9]{64}$/),
  amountMinor: createTransactionSchema.shape.amountMinor,
  type: createTransactionSchema.shape.type,
  occurredAt: createTransactionSchema.shape.occurredAt,
  upiId: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/).max(100).optional(),
});

export const categorizeNotificationSchema = z.strictObject({
  category: createTransactionSchema.shape.category,
});

export const emailTextSchema = z.strictObject({
  text: z.string().trim().min(10).max(4000),
});

export const importEmailSchema = emailTextSchema.extend({
  category: createTransactionSchema.shape.category,
  occurredAt: createTransactionSchema.shape.occurredAt,
});

export type EmailTextDto = z.infer<typeof emailTextSchema>;
export type ImportEmailDto = z.infer<typeof importEmailSchema>;

export type ImportNotificationDto = z.infer<typeof importNotificationSchema>;
export type CategorizeNotificationDto = z.infer<typeof categorizeNotificationSchema>;

export interface PendingNotification {
  id: string;
  amountMinor: number;
  type: "expense" | "income";
  occurredAt: string;
}

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;

export interface PublicTransaction extends CreateTransactionDto {
  id: string;
  currency: "INR";
  source: "manual" | "android_notification" | "email_paste";
  createdAt: string;
}
