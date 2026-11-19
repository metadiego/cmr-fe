"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Settings02Icon,
  ArrowLeftRightIcon,
  GitBranchIcon,
  SquareStackIcon,
} from "@hugeicons/core-free-icons";

import { getCashCountMode, setCashCountMode, type CashCountMode } from "@/lib/api/caja";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Un icono por modo (owner, 11-nov-2026: "3 iconos súper cool" en vez de solo texto). Puramente
// decorativo — el significado real sigue viniendo de `caja.countMode.<modo>` (i18n), esto solo
// ayuda a distinguir las 3 opciones de un vistazo.
const MODE_ICON: Record<CashCountMode, typeof ArrowLeftRightIcon> = {
  flexible: ArrowLeftRightIcon,
  split: GitBranchIcon,
  single: SquareStackIcon,
};

function useCashCountModeState(centroId: string | undefined) {
  const t = useTranslations("cashCountMode");
  const tRoot = useTranslations();
  const { state, refresh } = useResource(
    () => getCashCountMode(centroId ? [centroId] : undefined),
    [centroId],
  );
  const [busy, setBusy] = React.useState(false);

  async function cambiar(row: { clinicId: string }, mode: CashCountMode) {
    setBusy(true);
    try {
      await setCashCountMode(row.clinicId, mode);
      toast.success(t("guardado"));
      refresh();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return { state, busy, cambiar };
}

// Fila de 3 botones con icono (uno por modo). `modes` viene del GET — se pinta de ahí, nunca a mano
// (el handoff es explícito: no inventar las opciones).
function ModeButtons({
  modes,
  current,
  busy,
  onPick,
}: {
  modes: CashCountMode[];
  current: CashCountMode;
  busy: boolean;
  onPick: (m: CashCountMode) => void;
}) {
  const tRoot = useTranslations();
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          disabled={busy}
          onClick={() => onPick(m)}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
            m === current
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <HugeiconsIcon icon={MODE_ICON[m]} className="size-4 shrink-0" />
          {tRoot(`caja.countMode.${m}`)}
        </button>
      ))}
    </div>
  );
}

// Un centro, su modo de conteo (BE #566): la tarjeta completa, con título y ayuda — para la pantalla
// dedicada de Configuración. Sin `puedeEscribir`: solo lectura.
export function CashCountModeAdmin({
  centroId,
  puedeEscribir,
}: {
  centroId?: string; // undefined = el centro de la sesión
  puedeEscribir: boolean;
}) {
  const t = useTranslations("cashCountMode");
  const tRoot = useTranslations();
  const { state, busy, cambiar } = useCashCountModeState(centroId);

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (state.kind === "fail") return <p className="text-sm text-destructive">{state.message}</p>;
  const row = state.data[0];
  if (!row) return null;

  return (
    <div className="space-y-3 rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
      <h3 className="text-sm font-medium">{t("title")}</h3>
      <p className="text-xs text-muted-foreground">{t("help")}</p>
      {puedeEscribir ? (
        <ModeButtons modes={row.modes} current={row.mode} busy={busy} onPick={(m) => void cambiar(row, m)} />
      ) : (
        <p className="text-sm font-medium">{tRoot(`caja.countMode.${row.mode}`)}</p>
      )}
    </div>
  );
}

// Mismo control, en un botón de engranaje con un popover (owner, 11-nov-2026: en Cuadre Total no
// debe ocupar un área fija de la pantalla que después sale impresa — esta es la hoja que se
// entrega). Mismos datos, mismo guardado; no hay una segunda fuente de verdad con la tarjeta de
// Configuración de arriba.
export function CashCountModeQuickButton({ centroId }: { centroId?: string }) {
  const t = useTranslations("cashCountMode");
  const { state, busy, cambiar } = useCashCountModeState(centroId);
  const [open, setOpen] = React.useState(false);

  if (state.kind !== "ok" || !state.data[0]) return null;
  const row = state.data[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" title={t("title")} className="no-print">
          <HugeiconsIcon icon={Settings02Icon} className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto space-y-2 p-3">
        <p className="text-xs text-muted-foreground">{t("help")}</p>
        <ModeButtons modes={row.modes} current={row.mode} busy={busy} onPick={(m) => void cambiar(row, m)} />
      </PopoverContent>
    </Popover>
  );
}
