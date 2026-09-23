"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginSchema, registerSchema } from "@lifeos/shared";
import { login, register } from "@/lib/auth";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";
  const schema = isRegister ? registerSchema : loginSchema;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate with the exact same schema the API uses (@lifeos/shared).
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setBusy(true);
    try {
      if (isRegister) await register(email, password);
      else await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card" onSubmit={onSubmit}>
        <h1>{isRegister ? "Create your LifeOS account" : "Welcome back"}</h1>
        <p className="muted">
          {isRegister ? "One app for your whole life." : "Sign in to your dashboard."}
        </p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isRegister ? "new-password" : "current-password"}
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={busy}>
          {busy ? "Please wait…" : isRegister ? "Sign up" : "Sign in"}
        </button>

        <p className="muted" style={{ marginTop: 18, marginBottom: 0 }}>
          {isRegister ? (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/register">Create an account</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
