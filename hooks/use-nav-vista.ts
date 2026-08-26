"use client";

import * as React from "react";

// Preferencia POR DISPOSITIVO (localStorage, mismo patrón que components/agenda/dia-view.tsx
// VISTA_KEY): "clasica" = la barra horizontal de siempre (DEFAULT e intacta). "sidebar" = beta
// opcional, un sidebar en vez de la barra. Nadie pierde la clásica; alternar es instantáneo y
// reversible. Ver docs/plans/menu-principal-sidebar-opcional.md.
const NAV_VISTA_KEY = "cmr_nav_vista";
export type NavVista = "clasica" | "sidebar";

export function useNavVista(): [NavVista, (v: NavVista) => void] {
  const [vista, setVistaState] = React.useState<NavVista>("clasica");
  const [restored, setRestored] = React.useState(false);

  if (!restored && typeof window !== "undefined") {
    setRestored(true);
    const saved = window.localStorage.getItem(NAV_VISTA_KEY);
    if (saved === "sidebar" || saved === "clasica") setVistaState(saved);
  }

  const setVista = React.useCallback((v: NavVista) => {
    setVistaState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(NAV_VISTA_KEY, v);
  }, []);

  return [vista, setVista];
}
