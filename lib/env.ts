// Validated accessor for public env vars. Throws at import time if a required
// var is missing (mirrors the BE's fail-fast config). NEXT_PUBLIC_* vars must be
// referenced literally here — dynamic process.env[name] is not inlined client-side.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

if (!SUPABASE_URL) {
  throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const env = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  API_BASE_URL,
} as const;
