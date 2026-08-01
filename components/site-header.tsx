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

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { isActive } from "@/lib/nav";
import { NAV_MANIFEST } from "@/lib/nav-manifest";
import { useMenu } from "@/hooks/use-menu";
import { useMe } from "@/hooks/use-me";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { CenterSelector } from "@/components/center-selector";
import { SearchBar } from "@/components/search-bar";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  // registró (dedup por path — los items del BE mandan). Así nada queda "escondido" mientras
  // se organiza el menú RBAC del BE. Ver lib/nav-manifest.ts.
  const bePaths = new Set(navItems.map((m) => m.path));
  const manifestItems = NAV_MANIFEST.filter((r) => !bePaths.has(r.path)).map((r) => ({
    clave: `manifest:${r.path}`,
    labelKey: r.labelKey,
    path: r.path,
  }));
  const allItems: { clave: string; labelKey: string; path: string }[] = [
    ...navItems.map((m) => ({ clave: m.clave, labelKey: m.labelKey, path: m.path })),
    ...manifestItems,
  ];
  const grupos = [
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
  ].filter((g) => g.items.length > 0);
  // Session for the header (email + sign out). Anonymous → shows "sign in".
  const me = useMe();
  const session = me.kind === "ok" ? me.me : null;

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    setOpen(false);
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
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

        {/* Desktop nav — dynamic, RBAC-filtered from the BE (#6). Many verticals
            can be registered, so the row scrolls horizontally instead of
            clipping items off the right edge. */}
        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {grupos.map((g) => {
            const active = g.items.some((c) => isActive(pathname, c.path));
            return (
              <DropdownMenu key={g.clave}>
                <DropdownMenuTrigger
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tRoot(g.labelKey)}
                  <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto">
                  {g.items.map((c) => (
                    <DropdownMenuItem key={c.clave} asChild>
                      <Link href={c.path}>{tRoot(c.labelKey)}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>

        {/* Right cluster: search, theme, primary action */}
        <div className="ml-auto flex items-center gap-2">
          <CenterSelector />
          <SearchBar />
          {session ? <AlertasBell /> : null}
          <ModeToggle />
          <LanguageToggle />
          {session ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar className="size-7">
                {session.avatarUrl ? (
                  <AvatarImage src={session.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="text-xs">
                  {(session.email ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[12rem] truncate text-sm text-muted-foreground">
                {session.email}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={signOut}
                disabled={signingOut}
              >
                {signingOut ? t("signingOut") : t("signOut")}
              </Button>
            </div>
          ) : (
            <Button size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="/login">{t("signIn")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
