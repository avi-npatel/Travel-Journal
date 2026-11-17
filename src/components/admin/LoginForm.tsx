"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = getBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Wrong email or password."
          : signInError.message,
      );
      setBusy(false);
      return;
    }

    // Signing in proves who you are; the admin list decides what you can do.
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin !== true) {
      await supabase.auth.signOut();
      setError("That account is not allowed to manage this site.");
      setBusy(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="shell grid min-h-dvh place-items-center py-12">
      <form onSubmit={signIn} className="w-full max-w-sm">
        <p className="meta">Admin</p>
        <h1 className="display mt-2 text-5xl">Sign in</h1>

        <div className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              className="field"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="field"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-5 border-l-2 border-danger pl-3 text-sm text-danger">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary mt-7 w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="meta mt-8">
          <Link href="/" className="hover:text-accent">
            <span aria-hidden="true">← </span>Back to the site
          </Link>
        </p>
      </form>
    </div>
  );
}
