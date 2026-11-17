"use client";

import { THEME_SCRIPT } from "@/lib/theme";

/**
 * Puts the theme script in <head>. The browser runs it while parsing the
 * server's HTML, before anything is painted. React never needs to run it
 * again, so on the client it is marked as plain text (the approach the
 * Next.js "preventing flash" guide recommends for inline scripts).
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
