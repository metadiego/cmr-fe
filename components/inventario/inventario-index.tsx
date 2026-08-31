"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

// (c) Índice/subnav de Inventario: un solo punto de entrada que amarra las secciones ya
// existentes (sin rutas paralelas ni duplicados). Solo enlaza rutas REALES.
const SECTIONS: { key: string; href: string }[] = [
  // Existencias primero: "cuánto hay" es la pregunta más frecuente (stock por centro + consolidado).
  { key: "existencias", href: "/inventario/existencias" },
  { key: "viales", href: "/inventario/viales" },
  { key: "productos", href: "/inventario/productos" },
  { key: "recepcion", href: "/inventario/recibir-compra" },
  { key: "planificacion", href: "/inventario/planificacion" },
  { key: "recepcionFactura", href: "/inventario/recepcion-factura" },
  { key: "transferencias", href: "/inventario/transferencias" },
  { key: "recetas", href: "/inventario/recetas" },
  { key: "proveedores", href: "/inventario/proveedores" },
  { key: "amp", href: "/inventario/presentaciones-proveedor" },
  { key: "precios", href: "/precios" },
];

export function InventarioIndex() {
  const t = useTranslations("inventario.index");
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-8 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className="group flex flex-col justify-between rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgba(16,32,64,0.04),0_8px_20px_-12px_rgba(16,32,64,0.15)] ring-1 ring-foreground/10 transition-all hover:ring-primary/30 hover:shadow-[0_2px_6px_rgba(16,32,64,0.06),0_16px_32px_-12px_rgba(16,32,64,0.22)]"
          >
            <div>
              <h2 className="font-semibold">{t(`sections.${s.key}.title`)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`sections.${s.key}.desc`)}
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              {t("open")}
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
