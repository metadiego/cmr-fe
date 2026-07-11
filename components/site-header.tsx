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
import { useMenu } from "@/hooks/use-menu";
import { useMe } from "@/hooks/use-me";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { CenterSelector } from "@/components/center-selector";
import { SearchBar } from "@/components/search-bar";
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
  const topLevel = menu.filter((item) => !item.parentClave);
  // Submenús: hijos por parentClave. Un ítem de primer nivel con hijos se pinta
  // como dropdown; sin hijos, como enlace plano (compatible con lo de antes).
  const childrenOf = (clave: string) =>
    menu.filter((m) => m.parentClave === clave);
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
              {topLevel.map((item) => {
                const children = childrenOf(item.clave);
                const rowClass = (active: boolean, indent?: boolean) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    indent && "ml-3 text-[13px]",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  );
                if (children.length === 0) {
                  return (
                    <Link
                      key={item.clave}
                      href={item.path}
                      onClick={() => setOpen(false)}
                      className={rowClass(isActive(pathname, item.path))}
                    >
                      {tRoot(item.labelKey)}
                    </Link>
                  );
                }
                return (
                  <div key={item.clave} className="flex flex-col gap-0.5">
                    <span className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {tRoot(item.labelKey)}
                    </span>
                    {children.map((c) => (
                      <Link
                        key={c.clave}
                        href={c.path}
                        onClick={() => setOpen(false)}
                        className={rowClass(isActive(pathname, c.path), true)}
                      >
                        {tRoot(c.labelKey)}
                      </Link>
                    ))}
                  </div>
                );
              })}
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
          {topLevel.map((item) => {
            const children = childrenOf(item.clave);
            const linkClass = (active: boolean) =>
              cn(
                "shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              );
            if (children.length === 0) {
              return (
                <Link
                  key={item.clave}
                  href={item.path}
                  className={linkClass(isActive(pathname, item.path))}
                >
                  {tRoot(item.labelKey)}
                </Link>
              );
            }
            const active =
              isActive(pathname, item.path) ||
              children.some((c) => isActive(pathname, c.path));
            return (
              <DropdownMenu key={item.clave}>
                <DropdownMenuTrigger
                  className={cn(linkClass(active), "inline-flex items-center gap-1 outline-none")}
                >
                  {tRoot(item.labelKey)}
                  <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {children.map((c) => (
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
