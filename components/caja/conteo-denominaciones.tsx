"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { Denominacion, ConteoLinea, CuadreConItems } from "@/lib/api/caja";
import { contarCuadre } from "@/lib/api/caja";
import { apiErrorMessage } from "@/lib/api/errors";
import { ordenarDenominaciones, totalConteo, money } from "@/lib/caja/totales";
import { Input } from "@/components/ui/input";

// Conteo asistido por denominación (UI 2026): grilla mayor→menor, `cantidad × valor` por fila y
// TOTAL contado en vivo. Reusado por ambas divisiones (parametrizado por cuadreId) — NO se duplica.
// Debounced → POST /caja/cuadres/:id/conteo (el BE recalcula el efectivo). Solo tokens.
export function ConteoDenominaciones({
  cuadreId,
  denominaciones,
  inicial,
  onSaved,
}: {
  cuadreId: string;
  denominaciones: Denominacion[];
  inicial: Record<string, number>;
  onSaved: (cuadre: CuadreConItems) => void;
}) {
  const t = useTranslations("caja.count");
  const [cant, setCant] = React.useState<Record<string, number>>(inicial);
  const [saving, setSaving] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const ordenadas = React.useMemo(
    () => ordenarDenominaciones(denominaciones),
    [denominaciones],
  );
  const total = React.useMemo(
    () =>
      totalConteo(
        ordenadas.map((d) => ({ valor: d.valor, cantidad: cant[d.id] ?? 0 })),
      ),
    [ordenadas, cant],
  );

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function programarGuardado(next: Record<string, number>) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const conteos: ConteoLinea[] = Object.entries(next)
        .filter(([, c]) => c > 0)
        .map(([denominacionId, cantidad]) => ({ denominacionId, cantidad }));
      setSaving(true);
      try {
        const actualizado = await contarCuadre(cuadreId, conteos);
        onSaved(actualizado);
      } catch (err) {
        toast.error(apiErrorMessage(err));
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  function onChange(id: string, value: string) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    const next = { ...cant, [id]: n };
    setCant(next);
    programarGuardado(next);
  }

  if (ordenadas.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        {saving && (
          <span className="text-xs text-muted-foreground">{t("saving")}</span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_5rem_auto] gap-x-3 gap-y-1 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>{t("denomination")}</span>
        <span className="text-right">{t("quantity")}</span>
        <span className="text-right">{t("lineTotal")}</span>
      </div>
      <div className="divide-y">
        {ordenadas.map((d) => {
          const c = cant[d.id] ?? 0;
          return (
            <div
              key={d.id}
              className="grid grid-cols-[1fr_5rem_auto] items-center gap-x-3 px-4 py-2"
            >
              <span className="text-sm font-medium tabular-nums">
                {money(d.valor)}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={c === 0 ? "" : c}
                onChange={(e) => onChange(d.id, e.target.value)}
                className="h-8 text-right tabular-nums"
                aria-label={money(d.valor)}
              />
              <span className="min-w-20 text-right text-sm tabular-nums text-muted-foreground">
                {money(d.valor * c)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-sm font-semibold">{t("total")}</span>
        <span className="text-base font-semibold tabular-nums">
          {money(total)}
        </span>
      </div>
    </div>
  );
}
