"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { getStaff, type PersonalConPreferenciaFrontdesk } from "@/lib/api/personal";
import type { FrontdeskTab } from "@/lib/api/frontdesk";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";

// Pestaña activa del frontdesk, con dos aterrizajes automáticos (handoff aterrizar-en-consulta-
// handoff-fe) además del clic normal en una pestaña: (1) `?tab=<slug>` en la URL, p. ej. al volver de
// facturar una Consulta (ver volverHref en frontdesk-board.tsx); (2) si no hay URL, la preferencia
// `frontdeskStartsOnConsultation` de LA PERSONA logueada — BE PR #386 EN REVISIÓN, sin desplegar a esta
// fecha, así que hoy no llega nada y esto queda inerte. Extraído de frontdesk-board.tsx por su tope de
// líneas (DEBT, eslint.config.mjs).
export function useFrontdeskTab(
  centro: string | undefined,
  consultaTab: FrontdeskTab | null,
): [string, (slug: string) => void] {
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<string>(() => searchParams.get("tab") ?? "");
  const me = useMe();
  const myStaffId = me.kind === "ok" ? me.me.staffId : null;
  const prefRes = useResource<PersonalConPreferenciaFrontdesk | null>(
    () => (myStaffId ? getStaff(myStaffId, centro).catch(() => null) : Promise.resolve(null)),
    [myStaffId, centro],
  );
  if (tab === "" && prefRes.state.kind === "ok" && consultaTab && prefRes.state.data?.frontdeskStartsOnConsultation) {
    setTab(consultaTab.slug);
  }
  return [tab, setTab];
}
