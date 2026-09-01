"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Denominacion } from "@/lib/api/caja";
import { ordenarDenominaciones, totalConteo, money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Conteo asistido por denominación (UI 2026, calca la CMA legacy): grilla SIEMPRE visible
// (mayor→menor), `cantidad × valor` por fila y TOTAL contado en vivo. Componente CONTROLADO:
// el padre posee las cantidades y persiste al cerrar. `disabled` = solo lectura (cerrado / sin
// cajero / fecha anterior). Reusado por ambas divisiones — sin duplicar.
export function ConteoDenominaciones({
  denominaciones,
  cantidades,
  onChange,
  disabled,
  hint,
}: {
  denominaciones: Denominacion[];
  cantidades: Record<string, number>;
  onChange: (denominacionId: string, cantidad: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const t = useTranslations("caja.count");

  const ordenadas = React.useMemo(
    () => ordenarDenominaciones(denominaciones),
    [denominaciones],
  );
  const total = React.useMemo(
    () =>
      totalConteo(
        ordenadas.map((d) => ({ valor: d.valor, cantidad: cantidades[d.id] ?? 0 })),
      ),
    [ordenadas, cantidades],
  );

  return (
    <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        {hint && (
          <p className="mt-0.5 text-xs text-warning-foreground">⚠ {hint}</p>
        )}
      </div>
      {ordenadas.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_5.5rem_auto] gap-x-3 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>{t("denomination")}</span>
            <span className="text-right">{t("quantity")}</span>
            <span className="text-right">{t("lineTotal")}</span>
          </div>
          <div className="divide-y">
            {ordenadas.map((d) => {
              const c = cantidades[d.id] ?? 0;
              return (
                <div
                  key={d.id}
                  className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-x-3 px-4 py-1.5"
                >
                  <span className="text-sm font-medium tabular-nums">{money(d.valor)}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    disabled={disabled}
                    value={c === 0 ? "" : c}
                    onChange={(e) =>
                      onChange(d.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                    }
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
          <div
            className={cn(
              "flex items-center justify-between border-t px-4 py-3",
              disabled && "opacity-70",
            )}
          >
            <span className="text-sm font-semibold">{t("total")}</span>
            <span className="text-base font-semibold tabular-nums">{money(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}
