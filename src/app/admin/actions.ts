"use server";

import { updateTag } from "next/cache";
import { SITE_CACHE_TAG } from "@/lib/data";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Makes the public site show what was just saved in /admin.
 *
 * Public pages are served from a cache (see lib/data.ts). The admin screens
 * call this after every change; it throws that cache away, so the next
 * visitor gets pages built from the current database. No redeploy involved.
 *
 * Server actions are reachable by anyone who finds their id, so this checks
 * for an admin session first. The worst an outsider could do is nothing.
 */
export async function refreshPublicSite(): Promise<void> {
  const supabase = await createSessionClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) throw new Error("Not signed in as an admin.");

  updateTag(SITE_CACHE_TAG);
}
