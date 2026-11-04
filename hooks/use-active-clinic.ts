"use client";

import * as React from "react";

import { getActiveCentro } from "@/lib/tenant";
import { useMe } from "@/hooks/use-me";

// The clinic the person is working in (top bar cookie, else the profile's active clinic): the default
// for something NEW when a screen shows several clinics. Read from the cookie on the client only, so the
// server render and the first client render agree (null on the server).
const noSubscribe = () => () => {};

export function useActiveClinic(): string | null {
  const cookie = React.useSyncExternalStore(noSubscribe, getActiveCentro, () => null);
  const me = useMe();
  return cookie ?? (me.kind === "ok" ? me.me.activeClinicId : null);
}
