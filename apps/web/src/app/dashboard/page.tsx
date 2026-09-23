"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@lifeos/shared";
import { logout, me } from "@/lib/auth";

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

  return (
    <div className="center">
      <div className="card">
        <h1>LifeOS</h1>
        <p className="muted">Foundation is live. Modules land in the phases ahead.</p>
        <p>
          Signed in as <strong>{user?.email}</strong>
          <br />
          <span className="muted">role: {user?.role}</span>
        </p>
        <button onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}
