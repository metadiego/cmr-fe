"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { isActive } from "@/lib/nav";
import { useMenu } from "@/hooks/use-menu";
import { useMe } from "@/hooks/use-me";
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
import { AlertasBell } from "@/components/comunicaciones/alertas-bell";

// Shell ÚNICO: rail navy (AppSidebar) + inset con header y contenido. Reemplaza el
// esquema dual anterior (SiteHeader clásico / NavSidebar beta, alternados por
// una preferencia por dispositivo). El TooltipProvider envuelve todo el árbol:
// SidebarMenuButton pinta
// un Tooltip (tooltip-radix) en modo colapsado-a-iconos y sin este provider el
// colapso truena en runtime.
export function AppShell({ children }: { children: React.ReactNode }) {
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
  const active = menu
    .filter((m) => !!m.path && m.path !== "#" && isActive(pathname, m.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const sectionTitle = active ? labelOf(active) : "";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
            <SidebarTrigger />
            <span className="text-sm font-semibold">{sectionTitle}</span>
            <div className="ml-auto flex items-center gap-2">
              <CenterSelector />
              <SearchBar />
              {session ? <AlertasBell /> : null}
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
