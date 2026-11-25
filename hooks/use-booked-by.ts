"use client";

import * as React from "react";

import {
  BOOKED_BY_STORAGE_KEY,
  OWNER_STORAGE_KEY,
  bookedByChoice,
  ownerChoice,
} from "@/lib/appointments-day/day-list";

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private window, blocked storage: the default applies
  }
}

/** A choice remembered on this device under `key` (read once on mount, written on pick). */
function useRemembered(key: string): [string | null, (v: string) => void] {
  const [stored, setStored] = React.useState<string | null>(() => readStored(key));
  const set = React.useCallback(
    (v: string) => {
      setStored(v);
      try {
        window.localStorage.setItem(key, v);
      } catch {
        // not remembered; the choice still applies on this page
      }
    },
    [key],
  );
  return [stored, set];
}

/**
 * The Citas screen's "Booked by" choice (me / all / a staff id: who CREATED the row), remembered on this
 * device only. A convenience, never shared state: without storage it starts on the default (Me). Same
 * pattern as hooks/use-agenda-center.ts. null while it cannot be told yet (`me` or the staff options
 * still loading): see lib/appointments-day/day-list.ts `bookedByChoice`.
 */
export function useBookedBy(
  myStaffId: string | null | undefined,
  staffOptions: readonly string[] | null,
): [string | null, (v: string) => void] {
  const [stored, set] = useRemembered(BOOKED_BY_STORAGE_KEY);
  return [bookedByChoice(stored, myStaffId, staffOptions), set];
}

/**
 * The Citas screen's "Cartera" choice (the patient's portfolio owner): the URL (`?owner=`) first, then
 * this device, then All. `onUrl` writes the pick into the URL. null while it cannot be told yet: see
 * lib/appointments-day/day-list.ts `ownerChoice`.
 */
export function usePortfolioOwner(
  fromUrl: string | null,
  onUrl: (v: string) => void,
  myStaffId: string | null | undefined,
  staffOptions: readonly string[] | null,
): [string | null, (v: string) => void] {
  const [stored, remember] = useRemembered(OWNER_STORAGE_KEY);
  const set = React.useCallback(
    (v: string) => {
      remember(v);
      onUrl(v);
    },
    [remember, onUrl],
  );
  return [ownerChoice(fromUrl, stored, myStaffId, staffOptions), set];
}
