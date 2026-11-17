import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Anonymous client for the public site. It carries no session, so row level
 * security only ever lets it read published trips.
 */
export function createPublicClient() {
  const { url, key } = supabaseEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
