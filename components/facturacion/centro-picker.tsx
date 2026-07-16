"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building01Icon } from "@hugeicons/core-free-icons";
import type { Centro } from "@/lib/api/centers";

// Selector de centro compartido (gate de facturación). i18n en facturacion.general.pickCentro*.
export function CentroPicker({ centros, onPick }: { centros: Centro[]; onPick: (id: string) => void }) {
  const t = useTranslations("facturacion.general");
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <HugeiconsIcon icon={Building01Icon} className="size-5 text-primary" />
        <h2 className="text-sm font-semibold">{t("pickCentroTitle")}</h2>
      </div>
      <div className="grid gap-2">
        {centros.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <span className="font-medium">{c.nombre}</span>
            <span className="text-xs text-primary">{t("pickCentroGo")} →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
