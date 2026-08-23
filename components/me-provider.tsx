"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { getMe, type Me } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/types";

export type MeState =
  | { kind: "loading" }
  | { kind: "ok"; me: Me }
  | { kind: "fail"; message: string };

// Shared /auth/me state so the whole app fetches it ONCE. Without this, every
// useMe()/useCan()/<Can> mounts its own GET /auth/me — dozens of duplicate
// requests on permission-heavy screens (e.g. the day-view empty slots), which
// also made permission-gated UI flicker in as each request resolved.
const MeContext = React.createContext<MeState | null>(null);

function toMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.status} · ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

// Runs the single /auth/me fetch. `enabled` lets useMe() call it under the rules
// of hooks while skipping the request when a provider is already in the tree.
export function useMeFetch(enabled: boolean): MeState {
  const [state, setState] = React.useState<MeState>({ kind: "loading" });
  // Refetch al navegar: el login es un server action y el layout (donde vive el header) NO se remonta,
  // así que sin esto `me` quedaba con el valor de ANTES del login (anónimo) → «Iniciar sesión» y menú
  // viejo hasta un F5 manual. El redirect tras login cambia el pathname y dispara este refetch; igual al
  // cambiar de centro (que además recarga). Handoff avatar-y-sesion-al-entrar (#2 y #3).
  const pathname = usePathname();

  React.useEffect(() => {
    if (!enabled) return;
    let active = true;
    getMe()
      .then((me) => active && setState({ kind: "ok", me }))
      .catch((err: unknown) => active && setState({ kind: "fail", message: toMessage(err) }));
    return () => {
      active = false;
    };
  }, [enabled, pathname]);

  return state;
}

export function MeProvider({ children }: { children: React.ReactNode }) {
  const state = useMeFetch(true);
  return <MeContext.Provider value={state}>{children}</MeContext.Provider>;
}

// Returns the shared state when a MeProvider is mounted, or null otherwise.
export function useMeContext(): MeState | null {
  return React.useContext(MeContext);
}
