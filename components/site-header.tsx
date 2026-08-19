"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Menu01Icon,
  Stethoscope02Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";

import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { isActive } from "@/lib/nav";
import { NAV_MANIFEST } from "@/lib/nav-manifest";
import { resolveMenuIcon } from "@/lib/menu-icons";
import { useMenu } from "@/hooks/use-menu";
import { useMe, isAdmin } from "@/hooks/use-me";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CenterSelector } from "@/components/center-selector";
import { SearchBar } from "@/components/search-bar";
import { UserMenu } from "@/components/user-menu";
import { AlertasBell } from "@/components/comunicaciones/alertas-bell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Árbol del menú del BE anidado por `parentClave` (soporta 3–4 niveles). El BE ya devuelve los
// ítems ordenados por `orden`, así que preservamos el orden de llegada. `path "#"`/null = contenedor.
// tipo (cmr-be PR #230): 'grupo' = caja/dropdown; 'separador' = línea; resto = enlace.
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

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="flex items-center gap-2 font-semibold tracking-tight"
    >
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <HugeiconsIcon icon={Stethoscope02Icon} className="size-4" />
      </span>
      <span className="text-base">CMR</span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const t = useTranslations("nav");
  // Root translator for menu labelKeys (full keys like "nav.home").
  const tRoot = useTranslations();
  // Dynamic, RBAC-filtered nav from the BE (#6). Empty when unauthenticated.
  const menu = useMenu();
  const me = useMe();
  const session = me.kind === "ok" ? me.me : null;
  const puedeVerCatalogoCompleto = !!session && isAdmin(session);
  // Categorización 100% en el FE (independiente de la config/caché del menú del BE):
  // "En desarrollo" = la ruta existe como página; "Por desarrollar" = el resto.
  // Rutas reales de la app (prefijos). Actualizar al agregar módulos nuevos.
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
  // Una ruta "tiene página" si está en REAL_ROUTES o en el manifiesto (que por definición son
  // rutas reales con UI). Así los items del manifiesto caen en "En desarrollo", no en "Por desarrollar".
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
  // Catch-all de desarrollo: completa el menú con TODAS las páginas reales que el BE aún no
  // registró (dedup por path — los items del BE mandan). Solo para master/admin — el catálogo
  // completo es una herramienta de configuración, no algo que un usuario con permisos acotados
  // deba ver (aunque no pueda entrar, verlas ahí sugiere que sí tiene acceso). Ver lib/nav-manifest.ts.
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
  // «En desarrollo» / «Por desarrollar» son herramientas de trabajo INTERNO: la lista de lo que falta
  // por construir. Solo las ve admin/master, igual que el catch-all del manifiesto de arriba. El BE ya
  // exige el permiso `menu.desarrollo` (solo el rol admin lo tiene) y dejó de mandar esos ítems, pero
  // estos dos grupos los arma el FE por su cuenta, así que sin este gate seguían saliendo aunque se
  // quitara el permiso — ni con refresh desaparecían.
  // See cmr-be/docs/specs/menu-desarrollo-solo-admin-handoff-fe.md.
  const grupos = puedeVerCatalogoCompleto
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
  // Grupos de dominio del BE (Entrega A del handoff Menú-Grupos): raíces `g-*` de /me/menu con sus
  // hijos anidados por `parentClave`. SE SUMAN a los dos menús de desarrollo (que quedan tal cual).
  // 100% data-driven: si el BE no envía raíces `g-*`, no se pinta nada extra (sin regresión).
  // Agrupar por `tipo === 'grupo'` (cmr-be PR #230); fallback al prefijo `g-` por compatibilidad.
  // Un grupo sin hijos (el usuario no tiene permiso para ninguno de sus ítems) NO se pinta: un
  // botón que abre un dropdown vacío sugiere un acceso que no existe (ver atencionbay@cmr.test,
  // rol "atencion" — el BE manda la raíz g-facturacion/g-servicios/etc. aunque estén vacías).
  const domainGroups = buildMenuTree(menu)
    .filter((r) => r.tipo === "grupo" || r.clave.startsWith("g-"))
    .filter((r) => r.children.length > 0);
  // Etiqueta visible: labelCustom (nombre libre) pisa la clave i18n; si no, traducir labelKey.
  const labelOf = (n: { labelCustom?: string | null; labelKey: string }): string => {
    const custom = n.labelCustom?.trim();
    if (custom) return custom;
    return tRoot.has(n.labelKey) ? tRoot(n.labelKey) : n.labelKey;
  };
  const nodeActive = (n: MenuNode): boolean =>
    (!!n.path && n.path !== "#" && isActive(pathname, n.path)) || n.children.some(nodeActive);
  // Icono del nodo (si mostrarIcono y está en el catálogo).
  const iconOf = (n: MenuNode) => (n.mostrarIcono ? resolveMenuIcon(n.icon) : null);
  const nodeIcon = (n: MenuNode) => {
    const ic = iconOf(n);
    return ic ? <HugeiconsIcon icon={ic} className="size-4 opacity-70" /> : null;
  };
  // Ítems del dropdown de escritorio, recursivo: separador = línea; hoja = enlace; rama = submenú.
  const renderDesktopNodes = (nodes: MenuNode[]): React.ReactNode =>
    nodes.map((n) =>
      n.tipo === "separador" ? (
        <DropdownMenuSeparator key={n.clave} />
      ) : n.children.length > 0 ? (
        <DropdownMenuSub key={n.clave}>
          <DropdownMenuSubTrigger>
            {nodeIcon(n)}
            {labelOf(n)}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[70vh] overflow-y-auto">
            {renderDesktopNodes(n.children)}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : (
        <DropdownMenuItem key={n.clave} asChild>
          <Link href={n.path}>
            {nodeIcon(n)}
            {labelOf(n)}
          </Link>
        </DropdownMenuItem>
      ),
    );
  // Ítems del menú móvil (acordeón), recursivo: indentación por nivel; rama = encabezado + hijos.
  const renderMobileNodes = (nodes: MenuNode[], level = 0): React.ReactNode =>
    nodes.map((n) =>
      n.tipo === "separador" ? (
        <div
          key={n.clave}
          aria-hidden
          className="my-1 h-px bg-border/60"
          style={{ marginLeft: (level + 1) * 12 }}
        />
      ) : n.children.length > 0 ? (
        <div key={n.clave} className="flex flex-col gap-0.5">
          <span
            className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ marginLeft: level * 12 }}
          >
            {labelOf(n)}
          </span>
          {renderMobileNodes(n.children, level + 1)}
        </div>
      ) : (
        <Link
          key={n.clave}
          href={n.path}
          onClick={() => setOpen(false)}
          style={{ marginLeft: (level + 1) * 12 }}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
            isActive(pathname, n.path)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          {nodeIcon(n)}
          {labelOf(n)}
        </Link>
      ),
    );
  // Barra superior unificada: guía de desarrollo (primero) + grupos de dominio. La barra MIDE el
  // ancho disponible y las opciones que no caben se colapsan en "Más" — nada se corta ni se oculta.
  const locale = useLocale();
  type TopItem = {
    key: string;
    text: string;
    active: boolean;
    kind: "dev" | "domain";
    devItems?: { clave: string; labelKey: string; path: string }[];
    node?: MenuNode;
  };
  const topItems: TopItem[] = [
    ...grupos.map((g) => ({
      key: g.clave,
      text: tRoot.has(g.labelKey) ? tRoot(g.labelKey) : g.labelKey,
      active: g.items.some((c) => isActive(pathname, c.path)),
      kind: "dev" as const,
      devItems: g.items,
    })),
    ...domainGroups.map((g) => ({
      key: g.clave,
      text: labelOf(g),
      active: nodeActive(g),
      kind: "domain" as const,
      node: g,
    })),
  ];
  const triggerCls = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
    );
  // Contenido del dropdown de un ítem superior (reutilizado inline y dentro de "Más").
  const renderTopContent = (it: TopItem): React.ReactNode =>
    it.kind === "dev" ? (
      it.devItems!.map((c) => (
        <DropdownMenuItem key={c.clave} asChild>
          <Link href={c.path}>{tRoot(c.labelKey)}</Link>
        </DropdownMenuItem>
      ))
    ) : (
      <>
        <DropdownMenuLabel>{it.text}</DropdownMenuLabel>
        {renderDesktopNodes(it.node!.children)}
      </>
    );
  // Medición del ancho: cuántos ítems caben; el resto va a "Más". Recalcula al cambiar ancho/ítems/idioma.
  const barRef = React.useRef<HTMLDivElement>(null);
  const measRef = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState(topItems.length);
  const topKeys = topItems.map((i) => i.key).join("|");
  React.useLayoutEffect(() => {
    const bar = barRef.current;
    const meas = measRef.current;
    if (!bar || !meas) return;
    const compute = () => {
      const avail = bar.clientWidth - 8; // pequeño colchón
      const kids = Array.from(meas.querySelectorAll<HTMLElement>("[data-top]"));
      const moreW = meas.querySelector<HTMLElement>("[data-more]")?.offsetWidth ?? 84;
      const w = (el: HTMLElement) => el.offsetWidth + 4; // + gap
      let sum = 0;
      let n = 0;
      for (const el of kids) {
        sum += w(el);
        if (sum <= avail) n += 1;
        else break;
      }
      if (n < kids.length) {
        sum = 0;
        n = 0;
        for (const el of kids) {
          sum += w(el);
          if (sum + moreW <= avail) n += 1;
          else break;
        }
      }
      setFit(n);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [topKeys, locale]);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    setOpen(false);
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu trigger (hidden on md+) */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={t("openMenu")}
            >
              <HugeiconsIcon icon={Menu01Icon} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72"
            aria-describedby={undefined}
          >
            <SheetHeader>
              <SheetTitle asChild>
                <Brand onNavigate={() => setOpen(false)} />
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-2 flex flex-col gap-1 px-2">
              {/* Guía de desarrollo PRIMERO (igual que en escritorio). */}
              {grupos.map((g) => (
                <div key={g.clave} className="flex flex-col gap-0.5">
                  <span className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {tRoot(g.labelKey)}
                  </span>
                  {g.items.map((c) => (
                    <Link
                      key={c.clave}
                      href={c.path}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "ml-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                        isActive(pathname, c.path)
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                      )}
                    >
                      {tRoot(c.labelKey)}
                    </Link>
                  ))}
                </div>
              ))}
              {grupos.length > 0 && domainGroups.length > 0 ? (
                <div aria-hidden className="my-2 h-px bg-border/60" />
              ) : null}
              {domainGroups.map((g) => (
                <div key={g.clave} className="flex flex-col gap-0.5">
                  <span className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {labelOf(g)}
                  </span>
                  {renderMobileNodes(g.children, 1)}
                </div>
              ))}
            </nav>
            <div className="mt-4 space-y-2 px-2">
              {session ? (
                <>
                  <p className="truncate px-3 text-sm text-muted-foreground">
                    {session.email}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={signOut}
                    disabled={signingOut}
                  >
                    {signingOut ? t("signingOut") : t("signOut")}
                  </Button>
                </>
              ) : (
                <Button size="sm" className="w-full" asChild>
                  <Link href="/login" onClick={() => setOpen(false)}>
                    {t("signIn")}
                  </Link>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Brand */}
        <Brand />

        {/* Desktop nav — barra medida: muestra los ítems que caben y colapsa el resto en "Más".
            Orden: guía de desarrollo primero (nunca se oculta), luego los grupos de dominio. */}
        <nav
          ref={barRef}
          className="hidden min-w-0 flex-1 items-center gap-1 overflow-hidden md:flex"
        >
          {topItems.slice(0, fit).map((it) => (
            <DropdownMenu key={it.key}>
              <DropdownMenuTrigger className={triggerCls(it.active)}>
                {it.text}
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto">
                {renderTopContent(it)}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
          {fit < topItems.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={triggerCls(topItems.slice(fit).some((i) => i.active))}
              >
                {t("mas")}
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
                {topItems.slice(fit).map((it) => (
                  <DropdownMenuSub key={it.key}>
                    <DropdownMenuSubTrigger>{it.text}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-[70vh] overflow-y-auto">
                      {renderTopContent(it)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </nav>
        {/* Medidor oculto — replica los triggers para medir sus anchos sin afectar el layout. */}
        <div
          ref={measRef}
          aria-hidden
          className="pointer-events-none absolute top-0 -left-[9999px] hidden items-center gap-1 opacity-0 md:flex"
        >
          {topItems.map((it) => (
            <span key={it.key} data-top className={triggerCls(false)}>
              {it.text}
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-60" />
            </span>
          ))}
          <span data-more className={triggerCls(false)}>
            {t("mas")}
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-60" />
          </span>
        </div>

        {/* Cluster derecho: selector de centro, buscador retráctil, campana y menú del avatar
            (tema, idioma, ajustes, cerrar sesión — todo dentro del avatar). */}
        <div className="ml-auto flex items-center gap-2">
          <CenterSelector />
          <SearchBar />
          {session ? <AlertasBell /> : null}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
