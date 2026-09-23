"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { finishGoogleLogin } from "@/lib/auth";

export default function GoogleCompletePage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    finishGoogleLogin()
      .then(() => router.replace("/dashboard"))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Google sign-in failed."));
  }, [router]);

  return (
    <div className="center">
      <div className="card">
        <h1>{error ? "Sign-in failed" : "Finishing sign-in…"}</h1>
        {error && <><p className="error">{error}</p><Link href="/login">Try again</Link></>}
      </div>
    </div>
  );
}
