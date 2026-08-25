"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PaintBoardIcon, Menu01Icon, DashboardSquare01Icon, InvoiceIcon, ListSettingIcon,
  PrinterIcon, UserAccountIcon, CheckListIcon, StethoscopeIcon, ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

import { useMenu } from "@/hooks/use-menu";

// Índice de Configuración: la puerta de entrada a todo lo configurable. Se pintan SOLO las secciones que
// el BE le manda a esta persona en /me/menu (grupo g-configuracion), NO las nueve fijas: así, al abrir
// una tarjeta, nunca se topa con un 403, y conceder una sola sección la hace aparecer sin tocar el FE.
// Cada entrada aporta su icono y sus textos; el menú decide cuáles se ven. Handoff configuracion-delicada-solo-admin.
const SECCIONES = [
  { href: "/configuracion/apariencia", icon: PaintBoardIcon, key: "apariencia" },
  { href: "/configuracion/menu", icon: Menu01Icon, key: "menu" },
  { href: "/configuracion/tableros", icon: DashboardSquare01Icon, key: "tableros" },
  { href: "/configuracion/factura", icon: InvoiceIcon, key: "factura" },
  { href: "/configuracion/numeracion", icon: ListSettingIcon, key: "numeracion" },
  { href: "/configuracion/formatos", icon: PrinterIcon, key: "formatos" },
  { href: "/configuracion/datos-paciente", icon: UserAccountIcon, key: "datosPaciente" },
  { href: "/configuracion/requeridos", icon: CheckListIcon, key: "requeridos" },
  { href: "/configuracion/panel-enfermeria", icon: StethoscopeIcon, key: "panelEnfermeria" },
] as const;

export default function ConfiguracionIndexPage() {
  const t = useTranslations("configIndex");
  const menu = useMenu();
  // Rutas de configuración que el BE le manda a esta persona; el índice se limita a esas.
  const rutasDelMenu = new Set(menu.map((m) => m.path).filter(Boolean));
  const visibles = SECCIONES.filter((s) => rutasDelMenu.has(s.href));
  const ready = menu.length > 0;

  return (
    // Ancho completo: es un panel de administración. Ver norma uso-optimo-de-la-pantalla.
    <div className="mx-auto w-full max-w-none px-6 py-8 2xl:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

      {ready && visibles.length === 0 ? (
        <p className="mt-8 rounded-xl border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("sinAcceso")}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-3 rounded-xl border bg-card/60 p-4 shadow-sm transition-colors hover:bg-accent/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HugeiconsIcon icon={s.icon} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-medium">
                  {t(`sec.${s.key}.title`)}
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{t(`sec.${s.key}.desc`)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
