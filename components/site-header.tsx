"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon, Stethoscope02Icon } from "@hugeicons/core-free-icons";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { isActive, navItems } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { LanguageToggle } from "@/components/language-toggle";
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
  const [open, setOpen] = React.useState(false);
  const t = useTranslations("nav");

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
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(pathname, item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
            <div className="mt-4 px-2">
              <Button size="sm" className="w-full" asChild>
                <Link href="/login" onClick={() => setOpen(false)}>
                  {t("signIn")}
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Brand */}
        <Brand />

        {/* Desktop nav — flat text links, like the shadcn docs bar */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(pathname, item.href)
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        {/* Right cluster: search, theme, primary action */}
        <div className="ml-auto flex items-center gap-2">
          <SearchBar />
          <ModeToggle />
          <LanguageToggle />
          <Button size="sm" className="hidden sm:inline-flex" asChild>
            <Link href="/login">{t("signIn")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
