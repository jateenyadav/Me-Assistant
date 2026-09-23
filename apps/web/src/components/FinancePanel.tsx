"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createTransactionSchema,
  parseRupeeAmount,
  transactionCategories,
  type CreateTransactionDto,
  type PublicTransaction,
} from "@lifeos/shared";
import { authenticatedFetch } from "@/lib/auth";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

async function readError(response: Response): Promise<string> {
  if (response.status === 401) return "Session expired. Please sign in again.";
  const body = await response.json().catch(() => ({}));
  return typeof body.message === "string" ? body.message : `Request failed (${response.status})`;
}

export function FinancePanel() {
  const [transactions, setTransactions] = useState<PublicTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<CreateTransactionDto["type"]>("expense");
  const [category, setCategory] = useState<CreateTransactionDto["category"]>("other");
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    authenticatedFetch("/transactions")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as { transactions: PublicTransaction[] };
      })
      .then((result) => { if (active) setTransactions(result.transactions); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load transactions"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const amountMinor = parseRupeeAmount(amount);
    if (amountMinor === null) {
      setError("Enter a valid rupee amount with at most two decimal places.");
      return;
    }
    const parsed = createTransactionSchema.safeParse({
      amountMinor,
      type,
      category,
      note: note.trim() || undefined,
      occurredAt: new Date().toISOString(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid transaction");
      return;
    }

    setSaving(true);
    try {
      const response = await authenticatedFetch("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error(await readError(response));
      const { transaction } = (await response.json()) as { transaction: PublicTransaction };
      setTransactions((previous) => [transaction, ...previous].slice(0, 50));
      setAmount("");
      setNote("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save transaction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card finance-card" aria-labelledby="finance-heading">
      <h2 id="finance-heading">Transactions</h2>
      <p className="muted">Add a transaction manually. Automatic capture comes later.</p>
      <form onSubmit={onSave}>
        <div className="finance-fields">
          <div>
            <label htmlFor="amount">Amount (₹)</label>
            <input id="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="250.00" required />
          </div>
          <div>
            <label htmlFor="transaction-type">Type</label>
            <select id="transaction-type" value={type} onChange={(event) => setType(event.target.value as CreateTransactionDto["type"])}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label htmlFor="transaction-category">Category</label>
            <select id="transaction-category" value={category} onChange={(event) => setCategory(event.target.value as CreateTransactionDto["category"])}>
              {transactionCategories.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <label htmlFor="transaction-note">Note (optional)</label>
        <input id="transaction-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={140} placeholder="What was this for?" />
        {error && <p role="alert" className="error">{error}</p>}
        <button disabled={saving || loading} type="submit">{saving ? "Saving…" : "Add transaction"}</button>
      </form>
      {loading ? <p className="muted">Loading transactions…</p> : transactions.length === 0 ? (
        <p className="muted">No transactions yet.</p>
      ) : (
        <ul className="finance-list">
          {transactions.map((transaction) => (
            <li key={transaction.id}>
              <div>
                <strong>{transaction.note || transaction.category}</strong>
                <span className="muted">{transaction.category} · {new Date(transaction.occurredAt).toLocaleDateString("en-IN")}</span>
              </div>
              <strong className={transaction.type === "expense" ? "expense" : "income"}>
                {transaction.type === "expense" ? "−" : "+"}{currency.format(transaction.amountMinor / 100)}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
