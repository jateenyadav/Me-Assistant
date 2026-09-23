"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@lifeos/shared";
import { logout, me } from "@/lib/auth";
import { FinancePanel } from "@/components/FinancePanel";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Client-side guard: prove the token round-trip (with a silent refresh).
    let active = true;
    me().then((u) => {
      if (!active) return;
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="dashboard-shell">
      <header className="card dashboard-header">
        <h1>LifeOS</h1>
        <div><span className="muted">{user.email}</span><button onClick={onLogout}>Log out</button></div>
      </header>
      <FinancePanel />
    </main>
  );
}
