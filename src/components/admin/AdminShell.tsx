"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { isSignedInAdmin } from "@/lib/admin/api";
import { cn } from "@/lib/cn";
import { getBrowserClient } from "@/lib/supabase/browser";

type Access = "checking" | "admin" | "not-admin";

const LINKS = [
  { href: "/admin", label: "Trips" },
  { href: "/admin/settings", label: "Settings" },
];

/**
 * Frame around every signed-in admin screen. Shows nothing of the admin until
 * it has confirmed there is a session and that the account is on the admin
 * list. (The database enforces the same rule on every read and write.)
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [access, setAccess] = useState<Access>("checking");

  useEffect(() => {
    let cancelled = false;
    isSignedInAdmin().then((result) => {
      if (cancelled) return;
      if (result === "signed-out") router.replace("/admin/login");
      else setAccess(result);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut() {
    await getBrowserClient().auth.signOut();
    router.replace("/admin/login");
  }

  if (access === "checking") {
    return (
      <p className="meta grid min-h-dvh place-items-center" role="status">
        Checking sign-in…
      </p>
    );
  }

  if (access === "not-admin") {
    return (
      <div className="shell grid min-h-dvh place-items-center">
        <div className="max-w-md">
          <h1 className="display text-4xl">Not an admin account</h1>
          <p className="mt-4 text-soft">
            You are signed in, but this account is not on the admin list. Add it by running the one-line SQL
            statement from the README section &ldquo;Create your admin account&rdquo;.
          </p>
          <button type="button" className="btn mt-6" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-rule bg-paper">
        <div className="shell flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-5 sm:gap-8">
            <Link href="/admin" className="display text-xl leading-none">
              Admin
            </Link>
            <nav aria-label="Admin" className="flex items-center gap-4 sm:gap-6">
              {LINKS.map(({ href, label }) => {
                const active =
                  href === "/admin"
                    ? pathname === href || pathname.startsWith("/admin/trips")
                    : pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "meta py-2 hover:text-accent",
                      active ? "text-accent underline decoration-1 underline-offset-[6px]" : "meta-ink",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link href="/" className="meta meta-ink hover:text-accent" target="_blank">
              View site <span aria-hidden="true">↗</span>
            </Link>
            <button type="button" className="meta meta-ink hover:text-accent" onClick={signOut}>
              Sign out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="shell flex-1 pb-32 pt-8 sm:pt-12">{children}</main>
    </>
  );
}
