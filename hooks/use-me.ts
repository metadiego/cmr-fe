"use client";

import * as React from "react";

import { getMe, type Me } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/types";

export type MeState =
  | { kind: "loading" }
  | { kind: "ok"; me: Me }
  | { kind: "fail"; message: string };

// Client hook around GET /auth/me. apiFetch reads the browser Supabase session,
// so this only runs client-side. Used for cosmetic role gating and nav.
export function useMe(): MeState {
  const [state, setState] = React.useState<MeState>({ kind: "loading" });

  React.useEffect(() => {
    let active = true;
    getMe()
      .then((me) => {
        if (active) setState({ kind: "ok", me });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message =
          err instanceof ApiError
            ? `${err.status} · ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        setState({ kind: "fail", message });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function isAdmin(me: Me): boolean {
  return me.isMaster || me.roles.includes("admin");
}
