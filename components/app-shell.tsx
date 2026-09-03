"use client";

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

  // Título de sección: el ítem de menú activo más específico (path más largo que
  // matchea la ruta). Deriva del mismo menú del BE; sin match, se omite.
  const labelOf = (n: { labelCustom?: string | null; labelKey: string }): string => {
    const custom = n.labelCustom?.trim();
    if (custom) return custom;
    return tRoot.has(n.labelKey) ? tRoot(n.labelKey) : n.labelKey;
  };
  // Match against the FE-owned resolved route (not the BE path), so the section
  // title survives route renames (Phase 1+). Most specific (longest) route wins.
  const active = menu
    .map((m) => ({ item: m, route: routeForClave(m.clave, m.path) }))
    .filter(({ route }) => !!route && route !== "#" && isActive(pathname, route))
    .sort((a, b) => b.route.length - a.route.length)[0]?.item;
  const sectionTitle = active ? labelOf(active) : "";

  return (
    <TooltipProvider>
      {/* Aplica el idioma del usuario al arrancar (cookie ↔ /auth/me). No pinta nada. */}
      <LocaleSync />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header blanco fijo (no bg-background): el branding del centro sobreescribe
              --background a un índigo oscuro; forzamos blanco para el chrome tipo EHR. */}
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
          {/* Lienzo estándar off-white (EHR): cubre el --app-bg-image de branding para
              que ninguna página lo deje traslucir; las tarjetas blancas resaltan encima. */}
          <main className="flex-1 bg-muted p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
