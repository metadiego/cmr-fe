"use client";

import * as React from "react";

import { BOOKED_BY_STORAGE_KEY, bookedByChoice } from "@/lib/appointments-day/day-list";

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(BOOKED_BY_STORAGE_KEY);
  } catch {
    return null; // private window, blocked storage: the default applies
  }
}

/**
 * The Citas screen's "Booked by" choice (me / all / a staff id), remembered on this device only. A
 * convenience, never shared state: without storage it starts on the default (Me). Same pattern as
 * hooks/use-agenda-center.ts (read once on mount, written on pick). null while it cannot be told yet
 * (`me` or the staff options still loading): see lib/appointments-day/day-list.ts `bookedByChoice`.
 */
export function useBookedBy(
  myStaffId: string | null | undefined,
  staffOptions: readonly string[] | null,
): [string | null, (v: string) => void] {
  const [stored, setStored] = React.useState<string | null>(readStored);
  const set = React.useCallback((v: string) => {
    setStored(v);
    try {
      window.localStorage.setItem(BOOKED_BY_STORAGE_KEY, v);
    } catch {
      // not remembered; the choice still applies on this page
    }
  }, []);
  return [bookedByChoice(stored, myStaffId, staffOptions), set];
}
