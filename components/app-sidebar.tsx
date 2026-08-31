"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Stethoscope02Icon } from "@hugeicons/core-free-icons";

import { isActive } from "@/lib/nav";
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

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
  const session = me.kind === "ok" ? me.me : null;
  const puedeVerCatalogoCompleto = !!session && isAdmin(session);

  // Grupos de dominio del BE (raíces g-* / tipo grupo con hijos visibles).
  const domainGroups = buildNavGroups(menu, can);

  // --- Buckets de desarrollo (solo admin) — portado de la barra clásica -------
  // "En desarrollo" = la ruta tiene página; "Por desarrollar" = el resto.
  const REAL_ROUTES = [
    "/dashboard",
    "/inventario",
    "/clientes",
    "/citas",
    "/facturacion",
    "/tablero",
    "/inventario/productos",
    "/inventario/proveedores",
    "/inventario/presentaciones-proveedor",
    "/inventario/recibir-compra",
    "/inventario/recetas",
    "/precios",
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
  const renderSub = (nodes: NavNode[]): React.ReactNode =>
    nodes.map((n) =>
      n.tipo === "separador" ? (
        <SidebarSeparator key={n.clave} />
      ) : n.children.length > 0 ? (
        <SidebarMenuSubItem key={n.clave}>
          <SidebarMenuSubButton className="font-medium">
            {nodeIcon(n)}
            <span>{labelOf(n)}</span>
          </SidebarMenuSubButton>
          <SidebarMenuSub>{renderSub(n.children)}</SidebarMenuSub>
        </SidebarMenuSubItem>
      ) : (
        <SidebarMenuSubItem key={n.clave}>
          <SidebarMenuSubButton asChild isActive={isActive(pathname, n.path)}>
            <Link href={n.path}>
              {nodeIcon(n)}
              <span>{labelOf(n)}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ),
    );

  // Hijos directos de una raíz de grupo, en el SidebarMenu del grupo.
  const renderTop = (nodes: NavNode[]): React.ReactNode =>
    nodes.map((n) =>
      n.tipo === "separador" ? (
        <SidebarSeparator key={n.clave} />
      ) : n.children.length > 0 ? (
        <SidebarMenuItem key={n.clave}>
          <SidebarMenuButton tooltip={labelOf(n)}>
            {nodeIcon(n)}
            <span>{labelOf(n)}</span>
          </SidebarMenuButton>
          <SidebarMenuSub>{renderSub(n.children)}</SidebarMenuSub>
        </SidebarMenuItem>
      ) : (
        <SidebarMenuItem key={n.clave}>
          <SidebarMenuButton
            asChild
            isActive={isActive(pathname, n.path)}
            tooltip={labelOf(n)}
          >
            <Link href={n.path}>
              {nodeIcon(n)}
              <span>{labelOf(n)}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ),
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
        {devGroups.map((g) => (
          <SidebarGroup key={g.clave}>
            <SidebarGroupLabel>{labelOf(g)}</SidebarGroupLabel>
            <SidebarMenu>
              {g.items.map((c) => (
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
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {/* Grupos de dominio del BE. */}
        {domainGroups.map((g) => (
          <SidebarGroup key={g.clave}>
            <SidebarGroupLabel>{labelOf(g)}</SidebarGroupLabel>
            <SidebarMenu>{renderTop(g.children)}</SidebarMenu>
          </SidebarGroup>
        ))}
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
