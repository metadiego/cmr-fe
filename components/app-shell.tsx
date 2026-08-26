"use client";

import { SiteHeader } from "@/components/site-header";
import { NavSidebar } from "@/components/nav-sidebar";
import { useNavVista } from "@/hooks/use-nav-vista";

// Punto único donde se decide qué "chrome" envuelve la app: la barra clásica (SIEMPRE el default,
// e idéntica a como estaba antes de este archivo existir) o el sidebar beta opcional. Alternar es
// por dispositivo (localStorage) y reversible al instante — ver hooks/use-nav-vista.ts y el toggle
// en components/user-menu.tsx. Nada de lo que ya funcionaba cambia si no se activa el beta.
export function AppShell({ children }: { children: React.ReactNode }) {
  const [vista] = useNavVista();

  // `children` se monta UNA sola vez en cualquiera de las dos ramas — nunca duplicado — para no
  // disparar dos veces los fetches/streams de la página que envuelve.
  if (vista === "sidebar") {
    return <NavSidebar>{children}</NavSidebar>;
  }

  return (
    <>
      <SiteHeader />
      <main>{children}</main>
    </>
  );
}
