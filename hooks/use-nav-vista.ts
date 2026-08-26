"use client";

import * as React from "react";

// Preferencia POR DISPOSITIVO (localStorage, mismo patrón que components/agenda/dia-view.tsx
// VISTA_KEY): "clasica" = la barra horizontal de siempre (DEFAULT e intacta). "sidebar" = beta
// opcional, un sidebar en vez de la barra. Nadie pierde la clásica; alternar es instantáneo y
// reversible. Ver docs/plans/menu-principal-sidebar-opcional.md.
const NAV_VISTA_KEY = "cmr_nav_vista";
export type NavVista = "clasica" | "sidebar";

// Pub-sub a nivel de módulo: AppShell, UserMenu y NavSidebar llaman este hook cada uno por su
// cuenta (instancias de React.useState independientes). Sin este registro compartido, tocar el
// toggle en un componente no movía la vista en los demás hasta recargar la página entera —
// AppShell (quien decide qué se ve) nunca se entera de un setVista() ajeno.
const subscribers = new Set<(v: NavVista) => void>();
function notify(v: NavVista) {
  subscribers.forEach((fn) => fn(v));
}

export function useNavVista(): [NavVista, (v: NavVista) => void] {
  const [vista, setVistaState] = React.useState<NavVista>("clasica");
  const [restored, setRestored] = React.useState(false);

  if (!restored && typeof window !== "undefined") {
    setRestored(true);
    const saved = window.localStorage.getItem(NAV_VISTA_KEY);
    if (saved === "sidebar" || saved === "clasica") setVistaState(saved);
  }

  React.useEffect(() => {
    subscribers.add(setVistaState);
    return () => {
      subscribers.delete(setVistaState);
    };
  }, []);

  const setVista = React.useCallback((v: NavVista) => {
    if (typeof window !== "undefined") window.localStorage.setItem(NAV_VISTA_KEY, v);
    notify(v);
  }, []);

  return [vista, setVista];
}
