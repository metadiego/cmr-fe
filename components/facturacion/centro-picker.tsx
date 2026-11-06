"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Building01Icon, Location01Icon } from "@hugeicons/core-free-icons";
import type { Centro } from "@/lib/api/centers";

// Selector de centro compartido para pantallas de un centro por naturaleza (useCentroGate), p. ej. con la
// barra en «Ambos». i18n en facturacion.general.pickCentro*.
export function CentroPicker({ centros, onPick }: { centros: Centro[]; onPick: (id: string) => void }) {
  const t = useTranslations("facturacion.general");
  return (
    <section className="mx-auto w-full max-w-2xl py-10">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon icon={Building01Icon} className="size-5" />
        </span>
        <div className="grid gap-1">
          <h2 className="text-base font-semibold">{t("pickCentroTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("pickCentroHelp")}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {centros.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="group flex items-center gap-3 rounded-lg bg-card px-4 py-4 text-left shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 transition-all hover:bg-accent/40 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <HugeiconsIcon icon={Building01Icon} className="size-5" />
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate font-medium">{c.name}</span>
              {c.address ? (
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <HugeiconsIcon icon={Location01Icon} className="size-3 shrink-0" />
                  <span className="truncate">{c.address}</span>
                </span>
              ) : null}
            </span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
