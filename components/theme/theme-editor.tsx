"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import { configToCssVars, type ThemeConfig } from "@/lib/theme/config";
import { APPROVED_BRANDS, brandKeyFor } from "@/lib/theme/brand";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Selector de COLOR DE MARCA: la única personalización de tema que queda. Se elige uno de
// los colores pre-aprobados (lib/theme/brand.ts); el resto del diseño se deriva de forma
// cohesiva y no se puede editar. Controlado: el padre es dueño del `value` y lo persiste.
// Previsualiza escribiendo las vars derivadas en <html> (el padre recarga al guardar para
// llegar al estado autoritativo). Mismo nombre/props que antes para no tocar a sus usuarios.
export function ThemeEditor({
  value,
  onChange,
}: {
  value: ThemeConfig;
  onChange: (next: ThemeConfig) => void;
}) {
  const t = useTranslations("appearance");

  React.useEffect(() => {
    const vars = configToCssVars(value);
    const el = document.documentElement;
    for (const [name, v] of Object.entries(vars)) el.style.setProperty(name, v);
  }, [value]);

  const current = brandKeyFor(value.colors?.primary);
  // Solo se guarda el primario; se descartan las claves de color heredadas (fondo, etc.).
  const pick = (primary: string) => onChange({ ...value, colors: { primary } });

  return (
    <div className="space-y-2.5">
      <Label>{t("brandColor")}</Label>
      <div className="flex flex-wrap gap-2.5">
        {APPROVED_BRANDS.map((b) => {
          const selected = current === b.key;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => pick(b.primary)}
              aria-pressed={selected}
              title={t(`brand_${b.key}`)}
              className={cn(
                "grid size-9 place-items-center rounded-full ring-1 ring-foreground/15 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
              )}
              style={{ background: b.primary }}
            >
              {selected && (
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-4 text-white"
                />
              )}
              <span className="sr-only">{t(`brand_${b.key}`)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t("brandHint")}</p>
    </div>
  );
}
