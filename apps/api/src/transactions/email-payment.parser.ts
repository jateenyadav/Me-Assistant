import { parseRupeeAmount } from "@lifeos/shared";

const amountPattern = /(?:₹|\b(?:rs\.?|inr)\s*)\s*([0-9][0-9,]*(?:\.[0-9]*)?)/gi;
const validAmountPattern = /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})(?:\.\d{1,2})?$/;
const expensePattern = /\b(?:paid|debited|sent|payment successful)\b/i;
const incomePattern = /\b(?:received|credited)\b/i;
const excludedPattern = /\b(?:otp|one.time password|request(?:ed)?|pending|failed|declined|reversed|refund(?:ed)?|collect|due|overdue|unpaid|scheduled)\b/i;

export function parseEmailPayment(text: string): { amountMinor: number; type: "expense" | "income" } | null {
  if (excludedPattern.test(text)) return null;
  const isExpense = expensePattern.test(text);
  const isIncome = incomePattern.test(text);
  if (isExpense === isIncome) return null;

  const amounts = [...text.matchAll(amountPattern)].map((match) =>
    validAmountPattern.test(match[1]) ? parseRupeeAmount(match[1].replaceAll(",", "")) : null,
  );
  if (!amounts.length || amounts.some((amount) => amount === null) || new Set(amounts).size !== 1) return null;
  return { amountMinor: amounts[0]!, type: isExpense ? "expense" : "income" };
}
