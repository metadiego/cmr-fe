import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api/client";

// Closes the session's audit entry (cmr-be #648) before Supabase signs out, so the "salida" the
// Sessions tab shows is the user's own click, not inferred from inactivity. Best-effort and capped
// short: a slow or failing close must never delay or block the actual sign-out.
const CLOSE_TIMEOUT_MS = 1500;

export async function signOutAndLog(): Promise<void> {
  try {
    await apiFetch<{ closed: boolean }>("/audit/sessions/close", {
      method: "POST",
      signal: AbortSignal.timeout(CLOSE_TIMEOUT_MS),
    });
  } catch {
    // Best-effort: the sign-out below must happen regardless.
  }
  await createClient().auth.signOut();
}
