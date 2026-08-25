"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PaintBoardIcon, Menu01Icon, DashboardSquare01Icon, InvoiceIcon, ListSettingIcon,
  PrinterIcon, UserAccountIcon, CheckListIcon, StethoscopeIcon, ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

import { useCan } from "@/hooks/use-can";

// Índice de Configuración: la puerta de entrada a todo lo configurable. Antes «Configuración de la app»
// abría /configuracion, que NO tenía page.tsx (404), y parecía que no había nada — las 9 secciones sí
// existen. Cada tarjeta respeta el permiso de su sección (quien no administra algo, no la ve). Handoff
// configuracion-y-cambiar-clave.
const SECCIONES = [
  { href: "/configuracion/apariencia", permiso: "preferences.update", icon: PaintBoardIcon, key: "apariencia" },
  { href: "/configuracion/menu", permiso: "rbac.read", icon: Menu01Icon, key: "menu" },
  { href: "/configuracion/tableros", permiso: "tablero.admin", icon: DashboardSquare01Icon, key: "tableros" },
  { href: "/configuracion/factura", permiso: "centro.fiscal.write", icon: InvoiceIcon, key: "factura" },
  { href: "/configuracion/numeracion", permiso: "facturacion.numeracion.write", icon: ListSettingIcon, key: "numeracion" },
  { href: "/configuracion/formatos", permiso: "formatos.config", icon: PrinterIcon, key: "formatos" },
  { href: "/configuracion/datos-paciente", permiso: "pacientes.config", icon: UserAccountIcon, key: "datosPaciente" },
  { href: "/configuracion/requeridos", permiso: "servicios.update", icon: CheckListIcon, key: "requeridos" },
  { href: "/configuracion/panel-enfermeria", permiso: "panel.config", icon: StethoscopeIcon, key: "panelEnfermeria" },
] as const;

export default function ConfiguracionIndexPage() {
  const t = useTranslations("configIndex");
  const { can, ready } = useCan();
  const visibles = SECCIONES.filter((s) => can(s.permiso));

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
