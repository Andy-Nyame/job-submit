import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "./config";

export function createBrowserSupabaseClient() {
  const { anonKey, url } = getSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
}
