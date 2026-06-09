"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon, Stethoscope02Icon } from "@hugeicons/core-free-icons";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { isActive } from "@/lib/nav";
import { useMenu } from "@/hooks/use-menu";
import { useMe } from "@/hooks/use-me";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
              {topLevel.map((item) => (
                <Link
                  key={item.clave}
                  href={item.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(pathname, item.path)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  {tRoot(item.labelKey)}
                </Link>
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

        {/* Desktop nav — dynamic, RBAC-filtered from the BE (#6) */}
        <nav className="hidden items-center gap-1 md:flex">
          {topLevel.map((item) => (
            <Link
              key={item.clave}
              href={item.path}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(pathname, item.path)
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tRoot(item.labelKey)}
            </Link>
          ))}
        </nav>

        {/* Right cluster: search, theme, primary action */}
        <div className="ml-auto flex items-center gap-2">
          <CenterSelector />
          <SearchBar />
          <ModeToggle />
          <LanguageToggle />
          {session ? (
            <div className="hidden items-center gap-2 sm:flex">
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
