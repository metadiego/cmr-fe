"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { isActive } from "@/lib/nav";
import { routeForClave } from "@/lib/nav/manifest";
import { useMenu } from "@/hooks/use-menu";
import { useMe } from "@/hooks/use-me";
import { MeProvider } from "@/components/me-provider";
import { TooltipProvider } from "@/components/ui/tooltip-radix";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CenterSelector } from "@/components/center-selector";
import { SearchBar } from "@/components/search-bar";
import { UserMenu } from "@/components/user-menu";
import { LocaleSync } from "@/components/locale-sync";
import { AlertasBell } from "@/components/comunicaciones/alertas-bell";

// Shell ÚNICO: rail navy (AppSidebar) + inset con header y contenido. Reemplaza el
// esquema dual anterior (SiteHeader clásico / NavSidebar beta, alternados por
// una preferencia por dispositivo). El TooltipProvider envuelve todo el árbol:
// SidebarMenuButton pinta
// un Tooltip (tooltip-radix) en modo colapsado-a-iconos y sin este provider el
// colapso truena en runtime.
// Rutas públicas/auth que se pintan SIN el shell (sin rail ni header): son pantallas
// standalone (login, set-password, pendiente de aprobación). Antes el shell clásico las
// envolvía con una barra superior mínima; el rail navy completo aquí sobra y estorba.
const BARE_PREFIXES = ["/login", "/auth", "/pending"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <>{children}</>;
  }
  // MeProvider envuelve TODO el shell (rail + header + página) para que compartan UNA sola sesión /auth/me.
  // Antes vivía en app/(app)/layout.tsx, DEBAJO del shell → el rail y el header quedaban FUERA del provider
  // y hacían sus propios fetches locales de /auth/me (useMe + useCan). Uno de esos fetches en estado no-ok
  // (carrera/transitorio) dejaba al rail sin permisos → buildNavGroups filtraba todo → nav vacío + "Iniciar
  // sesión" aunque la página (su propio provider) estuviera logueada. Una sola fuente elimina ese desfase.
  return (
    <MeProvider>
      <ShellChrome>{children}</ShellChrome>
    </MeProvider>
  );
}

function ShellChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tRoot = useTranslations();
  const menu = useMenu();
  const me = useMe();
  const session = me.kind === "ok" ? me.me : null;
  // Sesión válida (/auth/me respondió 200) pero SIN perfil: cuenta autenticada que el BE no resuelve a un
  // perfil con permisos (ni es master). Antes se veía una pantalla muda; ahora se avisa para diagnosticar
  // rápido (p. ej. cuenta sin perfil enlazado). Handoff atencion-usuarios-sin-perfil-rbac-handoff-be.
  const sinPerfil =
    me.kind === "ok" && !me.me.isMaster && !me.me.profileId && (me.me.permissions?.length ?? 0) === 0;

  // Título de sección: el ítem de menú activo más específico (path más largo que
  // matchea la ruta). Deriva del mismo menú del BE; sin match, se omite.
  const labelOf = (n: { customLabel?: string | null; labelKey: string }): string => {
    const custom = n.customLabel?.trim();
    if (custom) return custom;
    return tRoot.has(n.labelKey) ? tRoot(n.labelKey) : n.labelKey;
  };
  // Match against the FE-owned resolved route (not the BE path), so the section
  // title survives route renames (Phase 1+). Most specific (longest) route wins.
  const active = menu
    .map((m) => ({ item: m, route: routeForClave(m.slug, m.path) }))
    .filter(({ route }) => !!route && route !== "#" && isActive(pathname, route))
    .sort((a, b) => b.route.length - a.route.length)[0]?.item;
  const sectionTitle = active ? labelOf(active) : "";

  return (
    <TooltipProvider>
      {/* Aplica el idioma del usuario al arrancar (cookie ↔ /auth/me). No pinta nada. */}
      <LocaleSync />
      <SidebarProvider>
        <AppSidebar />
        <ShellBody sectionTitle={sectionTitle} session={session} sinPerfil={sinPerfil}>{children}</ShellBody>
      </SidebarProvider>
    </TooltipProvider>
  );
}

// Cuerpo del shell (dentro del SidebarProvider para poder plegar el menú). Al interactuar en el
// CONTENIDO de la derecha (`<main>`), el menú de la izquierda se pliega solo para dar más pantalla.
// Solo si está abierto (idempotente) y en su modo (escritorio: setOpen; móvil: setOpenMobile). Va en
// el <main>, NO en el header, para que abrir el menú desde el trigger no lo cierre en el acto.
function ShellBody({
  children,
  sectionTitle,
  session,
  sinPerfil,
}: {
  children: React.ReactNode;
  sectionTitle: string;
  session: unknown;
  sinPerfil?: boolean;
}) {
  const t = useTranslations("shell");
  const { open, setOpen, openMobile, setOpenMobile, isMobile } = useSidebar();
  const colapsarAlInteractuar = React.useCallback(() => {
    if (isMobile) {
      if (openMobile) setOpenMobile(false);
    } else if (open) {
      setOpen(false);
    }
  }, [isMobile, open, openMobile, setOpen, setOpenMobile]);
  return (
    <SidebarInset>
      {/* Header blanco fijo (no bg-background): el branding del centro sobreescribe --background a un
          índigo oscuro; forzamos blanco para el chrome tipo EHR. */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4">
        <SidebarTrigger />
        <span className="text-sm font-semibold">{sectionTitle}</span>
        <div className="ml-auto flex items-center gap-2">
          <CenterSelector />
          <SearchBar />
          {session ? <AlertasBell /> : null}
          <UserMenu />
        </div>
      </header>
      {/* Lienzo estándar off-white (EHR): cubre el --app-bg-image de branding para que ninguna página
          lo deje traslucir; las tarjetas blancas resaltan encima. Interactuar aquí pliega el menú. */}
      <main className="flex-1 bg-muted p-6" onPointerDownCapture={colapsarAlInteractuar}>
        {sinPerfil ? (
          <div className="mx-auto mt-16 max-w-md rounded-md border border-warning/40 bg-warning/10 p-6 text-center">
            <p className="text-base font-semibold text-warning-foreground">{t("noProfileTitle")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("noProfileBody")}</p>
          </div>
        ) : (
          children
        )}
      </main>
    </SidebarInset>
  );
}
