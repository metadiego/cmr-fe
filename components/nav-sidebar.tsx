"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowLeft01Icon, Stethoscope02Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { isActive } from "@/lib/nav";
import { resolveMenuIcon } from "@/lib/menu-icons";
import { useMenu } from "@/hooks/use-menu";
import { useMe } from "@/hooks/use-me";
import { useNavVista } from "@/hooks/use-nav-vista";
import { SiteHeader } from "@/components/site-header";
import { CenterSelector } from "@/components/center-selector";
import { SearchBar } from "@/components/search-bar";
import { UserMenu } from "@/components/user-menu";
import { AlertasBell } from "@/components/comunicaciones/alertas-bell";

// Mismo tipo de árbol que site-header.tsx (no se importa de ahí para no tocar ese archivo —
// beta aislada a propósito, ver hooks/use-nav-vista.ts). Si el sidebar se adopta como default,
// unificar esta construcción de árbol con site-header.tsx en un hook compartido.
type MenuNode = {
  clave: string;
  labelKey: string;
  labelCustom?: string | null;
  tipo?: "item" | "grupo" | "separador";
  icon?: string | null;
  mostrarIcono?: boolean;
  path: string;
  children: MenuNode[];
};
type MenuTreeInput = {
  clave: string;
  labelKey: string;
  labelCustom?: string | null;
  tipo?: "item" | "grupo" | "separador";
  icon?: string | null;
  mostrarIcono?: boolean;
  path: string;
  parentClave?: string | null;
};
function buildMenuTree(items: MenuTreeInput[]): MenuNode[] {
  const byClave = new Map<string, MenuNode>();
  for (const i of items) {
    byClave.set(i.clave, {
      clave: i.clave,
      labelKey: i.labelKey,
      labelCustom: i.labelCustom,
      tipo: i.tipo,
      icon: i.icon,
      mostrarIcono: i.mostrarIcono,
      path: i.path,
      children: [],
    });
  }
  const roots: MenuNode[] = [];
  for (const i of items) {
    const node = byClave.get(i.clave)!;
    const parent = i.parentClave ? byClave.get(i.parentClave) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

// Sidebar de navegación (beta, opcional — ver hooks/use-nav-vista.ts). Mismos datos que la barra
// clásica (/me/menu vía useMenu()), solo reordenados en vertical con grupos colapsables y
// buscador arriba. "En desarrollo"/"Por desarrollar" NO se replican acá: son buckets sintéticos
// que arma site-header.tsx con su propia lógica de rutas (no existen así en /me/menu), y el dueño
// las marcó como herramientas de admin de baja prioridad que van a desaparecer — replicar esa
// lógica solo para esto no valía la duplicación. Quien las necesite usa "Volver a la barra
// clásica" mientras tanto.
export function NavSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tRoot = useTranslations();
  const t = useTranslations("navSidebar");
  const menu = useMenu();
  const me = useMe();
  const session = me.kind === "ok" ? me.me : null;
  const [, setVista] = useNavVista();

  const domainGroups = buildMenuTree(menu)
    .filter((r) => r.tipo === "grupo" || r.clave.startsWith("g-"))
    .filter((r) => r.children.length > 0);

  const labelOf = (n: { labelCustom?: string | null; labelKey: string }): string => {
    const custom = n.labelCustom?.trim();
    if (custom) return custom;
    return tRoot.has(n.labelKey) ? tRoot(n.labelKey) : n.labelKey;
  };
  const nodeActive = (n: MenuNode): boolean =>
    (!!n.path && n.path !== "#" && isActive(pathname, n.path)) || n.children.some(nodeActive);

  // Abiertos por default; se rastrea quién se CERRÓ a mano (arranca vacío, no depende de que
  // domainGroups ya tenga datos al montar — useMenu() llega vacío mientras carga, así que un Set
  // de "abiertos" armado en ese momento nunca tendría las claves reales).
  const [closedGroups, setClosedGroups] = React.useState<Set<string>>(() => new Set());
  const toggleGroup = (clave: string) =>
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });

  // Retráctil: un riel de solo iconos (por dispositivo, localStorage). Solo le importa a este
  // componente — a diferencia de la vista clásica/sidebar, nadie más necesita saber si está
  // colapsado, así que no hace falta el pub-sub de hooks/use-nav-vista.ts.
  const COLLAPSE_KEY = "cmr_nav_sidebar_collapsed";
  const [collapsed, setCollapsedState] = React.useState(false);
  const [collapseRestored, setCollapseRestored] = React.useState(false);
  if (!collapseRestored && typeof window !== "undefined") {
    setCollapseRestored(true);
    if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsedState(true);
  }
  function setCollapsed(v: boolean) {
    setCollapsedState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  }
  // Clic en el ícono de un grupo mientras está colapsado: expande el riel Y abre ese grupo, en vez
  // de no poder mostrar sus hijos en un ancho de solo-ícono.
  function expandirYAbrir(clave: string) {
    setCollapsed(false);
    setClosedGroups((prev) => {
      const next = new Set(prev);
      next.delete(clave);
      return next;
    });
  }

  const renderChildren = (nodes: MenuNode[], depth = 0): React.ReactNode =>
    nodes.map((n) =>
      n.tipo === "separador" ? (
        <div key={n.clave} aria-hidden className="my-1 h-px bg-sidebar-border" style={{ marginLeft: depth * 12 }} />
      ) : n.children.length > 0 ? (
        <div key={n.clave} className="flex flex-col gap-0.5">
          <span
            className="px-2.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/50"
            style={{ marginLeft: depth * 12 }}
          >
            {labelOf(n)}
          </span>
          {renderChildren(n.children, depth + 1)}
        </div>
      ) : (
        <Link
          key={n.clave}
          href={n.path}
          style={{ marginLeft: (depth + 1) * 10 }}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm transition-colors",
            isActive(pathname, n.path)
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--sidebar-primary)]"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          {labelOf(n)}
        </Link>
      ),
    );

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      {/* Mobile: sigue la barra clásica con su propio menú deslizable — no se rehizo un sidebar
          para mobile en esta beta. */}
      <div className="md:hidden">
        <SiteHeader />
      </div>

      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-[width] duration-150 md:flex",
          collapsed ? "w-14" : "w-64",
        )}
      >
        <div className={cn("flex items-center gap-2 px-3 py-3.5 font-semibold tracking-tight", collapsed && "justify-center px-0")}>
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={Stethoscope02Icon} className="size-4" />
          </span>
          {!collapsed && <span className="flex-1 truncate text-base">CMR</span>}
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={t("collapse")}
              title={t("collapse")}
              className="rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label={t("expand")}
            title={t("expand")}
            className="mx-auto mb-1 rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4 rotate-180" />
          </button>
        )}

        {!collapsed && (
          <>
            <div className="px-2 pb-2">
              <CenterSelector />
            </div>
            <div className="px-2 pb-2">
              <SearchBar className="w-full" />
            </div>
          </>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {domainGroups.map((g) => {
            const open = !closedGroups.has(g.clave);
            const icon = g.mostrarIcono ? resolveMenuIcon(g.icon) : null;
            const label = labelOf(g);
            if (collapsed) {
              return (
                <button
                  key={g.clave}
                  type="button"
                  onClick={() => expandirYAbrir(g.clave)}
                  title={label}
                  aria-label={label}
                  className={cn(
                    "flex w-full items-center justify-center rounded-md py-2 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    nodeActive(g) ? "text-sidebar-primary" : "text-sidebar-foreground/70",
                  )}
                >
                  {icon ? (
                    <HugeiconsIcon icon={icon} className="size-4" />
                  ) : (
                    <span className="text-[11px] font-bold uppercase">{label.charAt(0)}</span>
                  )}
                </button>
              );
            }
            return (
              <div key={g.clave} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.clave)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    nodeActive(g) ? "text-sidebar-primary" : "text-sidebar-foreground/80",
                  )}
                >
                  {icon ? <HugeiconsIcon icon={icon} className="size-4 opacity-70" /> : null}
                  <span className="flex-1 truncate">{label}</span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    className={cn("size-3.5 shrink-0 opacity-60 transition-transform", open && "-rotate-180")}
                  />
                </button>
                {open && <div className="flex flex-col gap-0.5 pb-1">{renderChildren(g.children, 1)}</div>}
              </div>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-2">
          {!collapsed && (
            <button
              type="button"
              onClick={() => setVista("clasica")}
              className="w-full rounded-md px-2.5 py-1 text-left text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {t("backToClassic")}
            </button>
          )}
          <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "px-1")}>
            <UserMenu />
            {!collapsed && session && (
              <span className="truncate text-sm font-medium">
                {[session.nombre, session.apellido].filter(Boolean).join(" ").trim() || session.email}
              </span>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden items-center justify-end gap-2 border-b px-4 py-2.5 md:flex">
          {session ? <AlertasBell /> : null}
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
