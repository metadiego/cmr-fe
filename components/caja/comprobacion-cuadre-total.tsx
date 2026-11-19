"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

import type { ComprobacionCuadreTotal as Comprobacion } from "@/lib/api/caja";
import { resumenComprobacion } from "@/lib/caja/cuadre-total";
import { money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";

// Comprobación Consulta / General / Suma / Día (handoff cuadre-unico-del-dia): las cuatro columnas que
// el gerente compara de un vistazo antes de cerrar. Solo PRESENTA lo que ya calculó el BE — nada se
// recalcula aquí, ni siquiera el `gap` del aviso.
export function ComprobacionCuadreTotal({
  check,
  ownCount,
}: {
  check: Comprobacion;
  ownCount: boolean;
}) {
  const t = useTranslations("caja.cuadre_total");
  const tc = useTranslations("caja.cuadre_total.comprobacion");
  const { descuadre, gap } = resumenComprobacion(check, ownCount);

  const columnas: Array<{ key: string; label: string; col: Comprobacion["day"]; strong?: boolean }> = [
    { key: "consultation", label: tc("consulta"), col: check.consultation },
    { key: "general", label: tc("general"), col: check.general },
    { key: "sum", label: tc("suma"), col: check.sum },
    { key: "day", label: tc("dia"), col: check.day, strong: true },
  ];

  return (
    <section className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{tc("titulo")}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-semibold" />
              {columnas.map((c) => (
                <th
                  key={c.key}
                  className={cn("px-4 py-2 text-right font-semibold", c.strong && "text-foreground")}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            <Fila label={tc("esperado")} columnas={columnas} pick={(c) => c.expected} />
            <Fila label={tc("fondo")} columnas={columnas} pick={(c) => c.fund} />
            <Fila label={tc("contado")} columnas={columnas} pick={(c) => c.counted} />
            <Fila label={tc("diferencia")} columnas={columnas} pick={(c) => c.difference} fuerte />
          </tbody>
        </table>
      </div>
      {descuadre && (
        <div className="m-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <HugeiconsIcon icon={Alert02Icon} className="size-4 shrink-0" />
          <span>{t("descuadre", { monto: money(Math.abs(gap)) })}</span>
        </div>
      )}
    </section>
  );
}

function Fila({
  label,
  columnas,
  pick,
  fuerte,
}: {
  label: string;
  columnas: Array<{ key: string; col: Comprobacion["day"]; strong?: boolean }>;
  pick: (c: Comprobacion["day"]) => number;
  fuerte?: boolean;
}) {
  return (
    <tr>
      <td className={cn("px-4 py-2 text-muted-foreground", fuerte && "font-semibold text-foreground")}>{label}</td>
      {columnas.map((c) => (
        <td
          key={c.key}
          className={cn(
            "px-4 py-2 text-right tabular-nums",
            (fuerte || c.strong) && "font-semibold",
          )}
        >
          {money(pick(c.col))}
        </td>
      ))}
    </tr>
  );
}
