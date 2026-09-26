"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createTransactionSchema,
  emailTextSchema,
  importEmailSchema,
  parseRupeeAmount,
  transactionCategories,
  type CreateTransactionDto,
  type FinanceSummary,
  type FinanceTrend,
  type PublicTransaction,
  type TransactionPage,
} from "@lifeos/shared";
import { authenticatedFetch } from "@/lib/auth";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

async function readError(response: Response): Promise<string> {
  if (response.status === 401) return "Session expired. Please sign in again.";
  const body = await response.json().catch(() => ({}));
  return typeof body.message === "string" ? body.message : `Request failed (${response.status})`;
}

async function getSummary(): Promise<FinanceSummary> {
  const response = await authenticatedFetch("/transactions/summary");
  if (!response.ok) throw new Error(await readError(response));
  const result = (await response.json()) as { summary: FinanceSummary };
  return result.summary;
}

async function getTrend(): Promise<FinanceTrend> {
  const response = await authenticatedFetch("/transactions/trend");
  if (!response.ok) throw new Error(await readError(response));
  const result = (await response.json()) as { trend: FinanceTrend };
  return result.trend;
}

async function getTransactionPage(cursor?: string): Promise<TransactionPage> {
  const response = await authenticatedFetch(`/transactions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as TransactionPage;
}

export function FinancePanel() {
  const [transactions, setTransactions] = useState<PublicTransaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [trend, setTrend] = useState<FinanceTrend | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
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
  const trendPeak = Math.max(1, ...(trend?.months.map((month) => Math.max(month.expenseMinor, month.incomeMinor)) ?? []));

  function refreshAnalytics() {
    void getSummary().then((result) => { setSummary(result); setSummaryError(null); })
      .catch((reason: unknown) => setSummaryError(reason instanceof Error ? reason.message : "Could not load summary"));
    void getTrend().then((result) => { setTrend(result); setTrendError(null); })
      .catch((reason: unknown) => setTrendError(reason instanceof Error ? reason.message : "Could not load trend"));
  }

  function refreshHistory() {
    void getTransactionPage()
      .then((page) => { setTransactions(page.transactions); setNextCursor(page.nextCursor); setHistoryError(null); })
      .catch((reason: unknown) => setHistoryError(`Saved, but history could not refresh: ${reason instanceof Error ? reason.message : "try reloading"}`));
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setHistoryError(null);
    try {
      const page = await getTransactionPage(nextCursor);
      setTransactions((previous) => {
        const seen = new Set(previous.map((transaction) => transaction.id));
        return [...previous, ...page.transactions.filter((transaction) => !seen.has(transaction.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (reason) {
      setHistoryError(reason instanceof Error ? reason.message : "Could not load older transactions");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    let active = true;
    getTransactionPage()
      .then((page) => { if (active) { setTransactions(page.transactions); setNextCursor(page.nextCursor); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load transactions"); })
      .finally(() => { if (active) setLoading(false); });
    getSummary()
      .then((result) => { if (active) setSummary(result); })
      .catch((reason: unknown) => { if (active) setSummaryError(reason instanceof Error ? reason.message : "Could not load summary"); });
    getTrend()
      .then((result) => { if (active) setTrend(result); })
      .catch((reason: unknown) => { if (active) setTrendError(reason instanceof Error ? reason.message : "Could not load trend"); });
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
      setTransactions((previous) => [transaction, ...previous]);
      refreshHistory();
      refreshAnalytics();
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
      await response.json();
      refreshHistory();
      refreshAnalytics();
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
      <section className="finance-summary" aria-labelledby="finance-summary-heading">
        <h3 id="finance-summary-heading">Last 30 days</h3>
        {summaryError && <p role="alert" className="error">Summary: {summaryError}</p>}
        {summary ? (
          <>
            <div className="finance-totals">
              <p>Spent <strong>{currency.format(summary.expenseMinor / 100)}</strong></p>
              <p>Received <strong>{currency.format(summary.incomeMinor / 100)}</strong></p>
            </div>
            {summary.expenseByCategory.length ? (
              <ul className="finance-breakdown">
                {summary.expenseByCategory.map(({ category: name, amountMinor }) => (
                  <li key={name}>
                    <span>{name}</span>
                    <span className="finance-breakdown-bar" aria-hidden="true" style={{ width: `${100 * amountMinor / summary.expenseMinor}%` }} />
                    <strong>{currency.format(amountMinor / 100)}</strong>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No expenses in this period.</p>}
          </>
        ) : !summaryError && <p className="muted">Loading summary…</p>}
      </section>
      <section className="finance-summary" aria-labelledby="finance-trend-heading">
        <h3 id="finance-trend-heading">Monthly activity · last 6 calendar months (UTC)</h3>
        {trendError && <p role="alert" className="error">Trend: {trendError}</p>}
        {trend ? (
          <ul className="finance-trend">
            {trend.months.map(({ month, expenseMinor, incomeMinor }) => {
              return (
                <li key={month}>
                  <strong>{new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" })}</strong>
                  <div className="finance-trend-bars">
                    <span>Spent <span className="finance-trend-bar expense" aria-hidden="true" style={{ width: `${100 * expenseMinor / trendPeak}%` }} />{currency.format(expenseMinor / 100)}</span>
                    <span>Received <span className="finance-trend-bar income" aria-hidden="true" style={{ width: `${100 * incomeMinor / trendPeak}%` }} />{currency.format(incomeMinor / 100)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : !trendError && <p className="muted">Loading monthly activity…</p>}
      </section>
      <p className="muted">Add a transaction manually, import a payment email, or review Android captures in the mobile app.</p>
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
      {historyError && <p role="alert" className="error">{historyError}</p>}
      {nextCursor && <button type="button" onClick={loadMore} disabled={loadingMore}>
        {loadingMore ? "Loading…" : "Load older transactions"}
      </button>}
    </section>
  );
}
