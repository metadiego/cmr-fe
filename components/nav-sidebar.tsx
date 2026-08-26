"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Stethoscope02Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { isActive } from "@/lib/nav";
import { resolveMenuIcon } from "@/lib/menu-icons";
import { useMenu } from "@/hooks/use-menu";
import { useMe, isAdmin } from "@/hooks/use-me";
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
// buscador arriba. "En desarrollo"/"Por desarrollar" (herramientas de desarrollo, solo
// admin/master) bajan a un enlace chico al fondo en vez de competir con los grupos reales.
export function NavSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tRoot = useTranslations();
  const t = useTranslations("navSidebar");
  const menu = useMenu();
  const me = useMe();
  const session = me.kind === "ok" ? me.me : null;
  const esAdmin = !!session && isAdmin(session);
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

  const devItems = menu.filter((m) => m.clave === "en-desarrollo" || m.clave === "por-desarrollar");

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

  const renderChildren = (nodes: MenuNode[], depth = 0): React.ReactNode =>
    nodes.map((n) =>
      n.tipo === "separador" ? (
        <div key={n.clave} aria-hidden className="my-1 h-px bg-border/60" style={{ marginLeft: depth * 12 }} />
      ) : n.children.length > 0 ? (
        <div key={n.clave} className="flex flex-col gap-0.5">
          <span
            className="px-2.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
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
              ? "bg-accent font-medium text-accent-foreground shadow-[inset_2px_0_0_var(--primary)]"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
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

      <aside className="hidden w-64 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex items-center gap-2 px-3 py-3.5 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={Stethoscope02Icon} className="size-4" />
          </span>
          <span className="text-base">CMR</span>
        </div>

        <div className="px-2 pb-2">
          <CenterSelector />
        </div>
        <div className="px-2 pb-2">
          <SearchBar className="w-full" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {domainGroups.map((g) => {
            const open = !closedGroups.has(g.clave);
            const icon = g.mostrarIcono ? resolveMenuIcon(g.icon) : null;
            return (
              <div key={g.clave} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.clave)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-accent/50",
                    nodeActive(g) ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {icon ? <HugeiconsIcon icon={icon} className="size-4 opacity-70" /> : null}
                  <span className="flex-1 truncate">{labelOf(g)}</span>
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

        <div className="space-y-2 border-t p-2">
          {esAdmin && devItems.length > 0 && (
            <details className="rounded-md px-2.5 py-1 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">{t("internalTools")}</summary>
              <div className="mt-1 flex flex-col gap-0.5">
                {devItems.map((d) => (
                  <Link
                    key={d.clave}
                    href={d.path}
                    className="rounded-md px-2 py-1 hover:bg-accent/50 hover:text-foreground"
                  >
                    {tRoot.has(d.labelKey) ? tRoot(d.labelKey) : d.labelKey}
                  </Link>
                ))}
              </div>
            </details>
          )}
          <button
            type="button"
            onClick={() => setVista("clasica")}
            className="w-full rounded-md px-2.5 py-1 text-left text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            {t("backToClassic")}
          </button>
          <div className="flex items-center gap-2 px-1">
            <UserMenu />
            {session && (
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
