import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

// The admin is a private tool that loads its data in the browser after
// checking the session, so it opts out of the instant-navigation checks
// Next.js runs on public pages.
export const instant = false;

/** Signed-in admin screens. The login page sits outside this group. */
export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    // AdminShell reads the current URL to highlight the open section; that
    // is only known per request, hence the Suspense boundary.
    <Suspense fallback={<p className="meta grid min-h-dvh place-items-center">Loading…</p>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
