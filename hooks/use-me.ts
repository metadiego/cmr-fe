"use client";

import { type Me } from "@/lib/api/auth";
import { type MeState, useMeContext, useMeFetch } from "@/components/me-provider";

export type { MeState };

// Client hook around GET /auth/me. apiFetch reads the browser Supabase session,
// so this only runs client-side. Used for cosmetic role gating and nav.
// Prefers the shared MeProvider (single fetch); if no provider is mounted it
// falls back to its own fetch, so callers work with or without the provider.
export function useMe(): MeState {
  const shared = useMeContext();
  const local = useMeFetch(shared === null);
  return shared ?? local;
}

export function isAdmin(me: Me): boolean {
  return me.isMaster || me.roles.includes("admin");
}
