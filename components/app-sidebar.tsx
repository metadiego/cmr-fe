"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Stethoscope02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { isActive } from "@/lib/nav";
import { routeForClave } from "@/lib/nav/manifest";
import { NAV_MANIFEST } from "@/lib/nav-manifest";
import { resolveMenuIcon } from "@/lib/menu-icons";
import { buildNavGroups, type NavNode } from "@/lib/nav/nav-groups";
import { useMenu } from "@/hooks/use-menu";
import { useMe, isAdmin } from "@/hooks/use-me";
import { useCan } from "@/hooks/use-can";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Estado de expandido/colapsado del nav plegable, recordado en localStorage.
// Por defecto TODO colapsado (sin preferencia guardada => cerrado): decisión de
// producto para un rail compacto; el usuario abre lo que usa y se recuerda.
const NAV_OPEN_KEY = "cmr:nav:open";

function useNavOpenState() {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  // Se lee DESPUÉS de montar para no romper la hidratación (server = todo cerrado).
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_OPEN_KEY);
      if (raw) setOpen(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* localStorage no disponible: se queda con el default (todo cerrado). */
    }
  }, []);
  const setClaveOpen = React.useCallback((clave: string, next: boolean) => {
    setOpen((prev) => {
      const updated = { ...prev, [clave]: next };
      try {
        window.localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }, []);
  return { isOpen: (c: string) => open[c] === true, setClaveOpen };
}

// Animación de altura (Radix Collapsible) — keyframes en globals.css.
const COLLAPSE_ANIM =
  "overflow-hidden data-[state=open]:animate-[collapsible-down_180ms_ease-out] data-[state=closed]:animate-[collapsible-up_180ms_ease-out]";

// Rail navy, shell ÚNICO (reemplaza SiteHeader + NavSidebar beta). Mismos datos y
// filtros que la barra clásica — el menú del BE (`GET /me/menu`, useMenu()) más el
// "catch-all" del manifiesto para admin — solo re-alojados en el primitivo Sidebar.
// La agrupación de dominio se extrajo a lib/nav/nav-groups.ts (buildNavGroups) y se
// testea ahí. Los buckets "En desarrollo / Por desarrollar" (solo admin) se arman
// aquí igual que en la barra clásica anterior, para no perder ese acceso al migrar.

export function AppSidebar() {
  const pathname = usePathname();
  const tRoot = useTranslations();
  const t = useTranslations("nav");
  const menu = useMenu();
  const me = useMe();
  const { can } = useCan();
  const { state: sidebarState } = useSidebar();
  const navOpen = useNavOpenState();
  // En modo icono (rail colapsado) forzamos abierto: si no, no habría destinos que
  // mostrar. En modo expandido respetamos la preferencia (por defecto cerrado).
  const effOpen = (clave: string) =>
    sidebarState === "collapsed" ? true : navOpen.isOpen(clave);
  const session = me.kind === "ok" ? me.me : null;
  const puedeVerCatalogoCompleto = !!session && isAdmin(session);

  // Grupos de dominio del BE (raíces g-* / tipo grupo con hijos visibles).
  const domainGroups = buildNavGroups(menu, can);

  // --- Buckets de desarrollo (solo admin) — portado de la barra clásica -------
  // "En desarrollo" = la ruta tiene página; "Por desarrollar" = el resto.
  const REAL_ROUTES = [
    "/dashboard",
    "/inventory",
    "/clientes",
    "/citas",
    "/billing",
    "/tablero",
    "/inventory/products",
    "/inventory/suppliers",
    "/inventory/supplier-presentations",
    "/inventory/receive-purchase",
    "/inventory/recipes",
    "/inventory/prices",
    "/servicios",
    "/comunicaciones",
    "/admin",
    "/configuracion/tableros",
    "/settings",
  ];
  const KNOWN_ROUTES = [...REAL_ROUTES, ...NAV_MANIFEST.map((r) => r.path)];
  const hasPage = (p: string) =>
    p === "/" ||
    KNOWN_ROUTES.some((r) => p === r || p.startsWith(r + "/") || p.startsWith(r));
  const navItems = menu.filter(
    (m) =>
      !!m.path &&
      m.path !== "#" &&
      m.clave !== "en-desarrollo" &&
      m.clave !== "por-desarrollar",
  );
  const bePaths = new Set(navItems.map((m) => m.path));
  const manifestItems = puedeVerCatalogoCompleto
    ? NAV_MANIFEST.filter((r) => !bePaths.has(r.path)).map((r) => ({
        clave: `manifest:${r.path}`,
        labelKey: r.labelKey,
        path: r.path,
      }))
    : [];
  const allItems: { clave: string; labelKey: string; path: string }[] = [
    ...navItems.map((m) => ({ clave: m.clave, labelKey: m.labelKey, path: m.path })),
    ...manifestItems,
  ];
  const devGroups = puedeVerCatalogoCompleto
    ? [
        {
          clave: "en-desarrollo",
          labelKey: "nav.en_desarrollo",
          items: allItems.filter((m) => hasPage(m.path)),
        },
        {
          clave: "por-desarrollar",
          labelKey: "nav.por_desarrollar",
          items: allItems.filter((m) => !hasPage(m.path)),
        },
      ].filter((g) => g.items.length > 0)
    : [];

  // Etiqueta visible: labelCustom (nombre libre) pisa la clave i18n; si no, traducir.
  const labelOf = (n: { labelCustom?: string | null; labelKey: string }): string => {
    const custom = n.labelCustom?.trim();
    if (custom) return custom;
    return tRoot.has(n.labelKey) ? tRoot(n.labelKey) : n.labelKey;
  };
  const nodeIcon = (n: NavNode) => {
    const ic = n.mostrarIcono ? resolveMenuIcon(n.icon) : null;
    return ic ? <HugeiconsIcon icon={ic} /> : null;
  };

  // Hijos de un grupo, recursivo dentro de SidebarMenuSub (soporta N niveles).
  // Un ítem con hijos es plegable (Collapsible); una hoja es un enlace.
  const renderSub = (nodes: NavNode[]): React.ReactNode =>
    nodes.map((n) =>
      n.tipo === "separador" ? (
        <SidebarSeparator key={n.clave} />
      ) : n.children.length > 0 ? (
        <Collapsible
          key={n.clave}
          asChild
          open={effOpen(n.clave)}
          onOpenChange={(o) => navOpen.setClaveOpen(n.clave, o)}
          className="group/subitem"
        >
          <SidebarMenuSubItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuSubButton className="cursor-pointer font-medium">
                {nodeIcon(n)}
                <span>{labelOf(n)}</span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="ml-auto size-3.5 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]/subitem:rotate-90"
                />
              </SidebarMenuSubButton>
            </CollapsibleTrigger>
            <CollapsibleContent className={COLLAPSE_ANIM}>
              <SidebarMenuSub>{renderSub(n.children)}</SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuSubItem>
        </Collapsible>
      ) : (
        <SidebarMenuSubItem key={n.clave}>
          <SidebarMenuSubButton
            asChild
            isActive={isActive(pathname, routeForClave(n.clave, n.path))}
          >
            <Link href={routeForClave(n.clave, n.path)}>
              {nodeIcon(n)}
              <span>{labelOf(n)}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ),
    );

  // Hijos directos de una raíz de grupo, en el SidebarMenu del grupo. Un ítem con
  // hijos es plegable (segundo nivel); una hoja es un enlace.
  const renderTop = (nodes: NavNode[]): React.ReactNode =>
    nodes.map((n) =>
      n.tipo === "separador" ? (
        <SidebarSeparator key={n.clave} />
      ) : n.children.length > 0 ? (
        <Collapsible
          key={n.clave}
          asChild
          open={effOpen(n.clave)}
          onOpenChange={(o) => navOpen.setClaveOpen(n.clave, o)}
          className="group/item"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip={labelOf(n)} className="cursor-pointer">
                {nodeIcon(n)}
                <span>{labelOf(n)}</span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]/item:rotate-90"
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent className={COLLAPSE_ANIM}>
              <SidebarMenuSub>{renderSub(n.children)}</SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      ) : (
        <SidebarMenuItem key={n.clave}>
          <SidebarMenuButton
            asChild
            isActive={isActive(pathname, routeForClave(n.clave, n.path))}
            tooltip={labelOf(n)}
          >
            <Link href={routeForClave(n.clave, n.path)}>
              {nodeIcon(n)}
              <span>{labelOf(n)}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ),
    );

  // Una SECCIÓN plegable: la etiqueta del grupo es el disparador (chevron), su
  // contenido (los ítems) se expande/colapsa. Reutilizada por grupos de dominio y
  // por los buckets de desarrollo.
  const renderSection = (
    clave: string,
    label: string,
    children: React.ReactNode,
  ): React.ReactNode => (
    <Collapsible
      key={clave}
      open={effOpen(clave)}
      onOpenChange={(o) => navOpen.setClaveOpen(clave, o)}
      className="group/section"
    >
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-1 hover:text-sidebar-foreground">
            <span className="flex-1 truncate text-left">{label}</span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-3.5 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]/section:rotate-90"
            />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent className={COLLAPSE_ANIM}>
          <SidebarGroupContent>
            <SidebarMenu>{children}</SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );

  const [signingOut, setSigningOut] = React.useState(false);
  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    // Navegación DURA (igual que user-menu.tsx): limpia todo el estado de sesión.
    window.location.assign("/login");
  }

  const fullName = session
    ? [session.nombre, session.apellido].filter(Boolean).join(" ").trim()
    : "";
  const displayName = session
    ? fullName || (session.email ? session.email.split("@")[0] : "")
    : "";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 font-semibold tracking-tight"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={Stethoscope02Icon} className="size-4" />
          </span>
          <span className="text-base group-data-[collapsible=icon]:hidden">CMR</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Guía de desarrollo primero (solo admin), igual que la barra clásica. */}
        {devGroups.map((g) =>
          renderSection(
            g.clave,
            labelOf(g),
            g.items.map((c) => (
              <SidebarMenuItem key={c.clave}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(pathname, c.path)}
                  tooltip={labelOf(c)}
                >
                  <Link href={c.path}>
                    <span>{labelOf(c)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )),
          ),
        )}

        {/* Grupos de dominio del BE. */}
        {domainGroups.map((g) =>
          renderSection(g.clave, labelOf(g), renderTop(g.children)),
        )}
      </SidebarContent>

      <SidebarFooter>
        {session ? (
          <div className="flex flex-col gap-2 group-data-[collapsible=icon]:items-center">
            <div className="min-w-0 px-2 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName}
              </p>
              {session.email ? (
                <p className="truncate text-xs text-sidebar-foreground/60">
                  {session.email}
                </p>
              ) : null}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:px-0"
              onClick={signOut}
              disabled={signingOut}
            >
              <span className="group-data-[collapsible=icon]:hidden">
                {signingOut ? t("signingOut") : t("signOut")}
              </span>
            </Button>
          </div>
        ) : (
          <Button size="sm" className="w-full" asChild>
            <Link href="/login">{t("signIn")}</Link>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
