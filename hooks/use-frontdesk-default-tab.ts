"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { getStaff, type PersonalConPreferenciaFrontdesk } from "@/lib/api/personal";
import type { FrontdeskTab } from "@/lib/api/frontdesk";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";

// Pestaña activa del frontdesk, con dos aterrizajes automáticos (handoff aterrizar-en-consulta-
// handoff-fe) además del clic normal en una pestaña: (1) `?tab=<slug>` en la URL, p. ej. al volver de
// facturar una Consulta; (2) si no hay URL, la preferencia `frontdeskStartsOnConsultation` de LA
// PERSONA logueada — BE PR #386 EN REVISIÓN, sin desplegar a esta fecha, así que hoy no llega nada y
// esto queda inerte. Extraído de frontdesk-board.tsx por su tope de líneas (DEBT, eslint.config.mjs).
//
// El setter TAMBIÉN escribe `?tab=` en la URL real (router.replace, sin scroll): así "volver" en
// cualquier factura (que captura su propia pathname+query al invocar "Facturar", ver
// acciones-modal.tsx/tablero-dinamico.tsx) ya trae el tab correcto solo, sin tener que mandarlo
// aparte — "devolver a quien llamó" funciona igual aquí que en cualquier otra pantalla.
export function useFrontdeskTab(
  centro: string | undefined,
  consultaTab: FrontdeskTab | null,
): [string, (slug: string) => void, string | null] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTabState] = React.useState<string>(() => searchParams.get("tab") ?? "");
  const setTab = React.useCallback(
    (slug: string) => {
      setTabState(slug);
      const qp = new URLSearchParams(searchParams.toString());
      qp.set("tab", slug);
      router.replace(`${pathname}?${qp.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );
  const me = useMe();
  const myStaffId = me.kind === "ok" ? me.me.staffId : null;
  const prefRes = useResource<PersonalConPreferenciaFrontdesk | null>(
    () => (myStaffId ? getStaff(myStaffId, centro).catch(() => null) : Promise.resolve(null)),
    [myStaffId, centro],
  );
  if (tab === "" && prefRes.state.kind === "ok" && consultaTab && prefRes.state.data?.frontdeskStartsOnConsultation) {
    setTab(consultaTab.slug);
  }
  // Pestaña de ESTADO con la que abre el tablero de Consulta, de la persona logueada (null = por defecto).
  // La consume GenericBoard para seleccionar ese estado al montar. Handoff traer-al-dia-y-la-pestana-inicial.
  const consultaInitialEstado =
    prefRes.state.kind === "ok" ? prefRes.state.data?.consultationBoardInitialTab ?? null : null;
  return [tab, setTab, consultaInitialEstado];
}
