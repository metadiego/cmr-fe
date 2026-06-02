import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Browser-side Supabase client for use in Client Components.
export function createClient() {
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}
