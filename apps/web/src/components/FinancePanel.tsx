"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createTransactionSchema,
  emailTextSchema,
  importEmailSchema,
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
  const [emailText, setEmailText] = useState("");
  const [emailReview, setEmailReview] = useState<{ text: string; amountMinor: number; type: "expense" | "income" } | null>(null);
  const [emailCategory, setEmailCategory] = useState<CreateTransactionDto["category"]>("other");
  const [emailDate, setEmailDate] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

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

  async function onPreviewEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    setEmailReview(null);
    const parsed = emailTextSchema.safeParse({ text: emailText });
    if (!parsed.success) {
      setEmailError("Paste a payment confirmation (10–4000 characters).");
      return;
    }
    setEmailSaving(true);
    try {
      const response = await authenticatedFetch("/transactions/emails/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error(await readError(response));
      const { payment } = (await response.json()) as { payment: { amountMinor: number; type: "expense" | "income" } };
      setEmailReview({ text: emailText, ...payment });
    } catch (reason) {
      setEmailError(reason instanceof Error ? reason.message : "Could not review email");
    } finally {
      setEmailSaving(false);
    }
  }

  async function onImportEmail() {
    if (!emailReview || emailReview.text !== emailText) return;
    const paymentDate = emailDate ? new Date(emailDate) : null;
    const parsed = importEmailSchema.safeParse({
      text: emailReview.text, category: emailCategory,
      occurredAt: paymentDate && !Number.isNaN(paymentDate.getTime()) ? paymentDate.toISOString() : "",
    });
    if (!parsed.success) {
      setEmailError("Select the payment's date and time before importing.");
      return;
    }
    setEmailError(null);
    setEmailSaving(true);
    try {
      const response = await authenticatedFetch("/transactions/emails", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error(await readError(response));
      const { transaction } = (await response.json()) as { transaction: PublicTransaction };
      setTransactions((previous) => [transaction, ...previous.filter((item) => item.id !== transaction.id)].slice(0, 50));
      setEmailText("");
      setEmailReview(null);
      setEmailDate("");
    } catch (reason) {
      setEmailError(reason instanceof Error ? reason.message : "Could not import email");
    } finally {
      setEmailSaving(false);
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
      <form className="email-import" onSubmit={onPreviewEmail}>
        <h3>Import a payment email</h3>
        <p className="muted">Copy a completed INR payment confirmation from your email. Review it before saving; LifeOS does not connect to your mailbox or retain the message.</p>
        <label htmlFor="payment-email">Payment email text</label>
        <textarea id="payment-email" value={emailText} onChange={(event) => setEmailText(event.target.value)} maxLength={4000} rows={4} placeholder="You paid INR 250.00…" />
        <button type="submit" disabled={emailSaving}>{emailSaving ? "Working…" : "Review payment"}</button>
        {emailReview?.text === emailText && (
          <div aria-live="polite">
            <p>Detected {emailReview.type}: {currency.format(emailReview.amountMinor / 100)}. Confirm the category and actual payment time.</p>
            <label htmlFor="email-category">Category</label>
            <select id="email-category" value={emailCategory} onChange={(event) => setEmailCategory(event.target.value as CreateTransactionDto["category"])}>
              {transactionCategories.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
            </select>
            <label htmlFor="email-date">Payment date and time</label>
            <input id="email-date" type="datetime-local" value={emailDate} onChange={(event) => setEmailDate(event.target.value)} required />
            {emailDate && transactions.some((transaction) =>
              transaction.type === emailReview.type && transaction.amountMinor === emailReview.amountMinor &&
              Math.abs(new Date(transaction.occurredAt).getTime() - new Date(emailDate).getTime()) < 24 * 60 * 60 * 1000,
            ) && <p role="status">A similar payment already appears in recent history. Check it before importing to avoid a duplicate.</p>}
            <button type="button" onClick={onImportEmail} disabled={emailSaving || !emailDate}>Confirm import</button>
          </div>
        )}
        {emailError && <p role="alert" className="error">{emailError}</p>}
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
