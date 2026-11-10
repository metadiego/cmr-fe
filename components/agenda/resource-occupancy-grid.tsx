"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getDayOccupancy, type DayOccupancy, type OccupancyCell } from "@/lib/api/resources";
import { useResource } from "@/hooks/use-resource";
import { useFranjaResaltada } from "@/components/agenda/franja-resaltada";
import { cn } from "@/lib/utils";

// PANORAMA por RECURSO × hora del día completo (GET /resources/day-occupancy): la «agenda del recurso» que
// pidió el dueño — de un vistazo, qué puesto está libre a cada hora y dónde está el cuello de botella (%
// de ocupación por recurso). Rooms de láser, sillas de suero, etc., cada uno una fila; las horas, columnas.
// Solo lectura. Degrada a nada si el endpoint no responde.
export function ResourceOccupancyGrid({ fecha, centro }: { fecha: string; centro?: string }) {
  const t = useTranslations("serviceDay");
  const tRoot = useTranslations();

  const occRes = useResource<DayOccupancy | null>(
    () => getDayOccupancy(fecha, centro).catch(() => null),
    [fecha, centro],
  );
  const occ = occRes.state.kind === "ok" ? occRes.state.data : null;
  const horaAhora = useFranjaResaltada(occ?.slots ?? []);

  if (occRes.state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  }
  if (!occ || occ.resources.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">{t("resource")}</th>
            {occ.slots.map((s) => (
              <th
                key={s}
                className={cn(
                  "px-1 py-2 text-center font-mono font-medium tabular-nums text-muted-foreground",
                  s === horaAhora && "text-primary",
                )}
              >
                {s.slice(0, 5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {occ.resources.map((r) => {
            const byTime = new Map(r.cells.map((c) => [c.time, c]));
            return (
              <tr key={r.id} className="border-t">
                <th className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left align-middle font-normal">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="font-medium">{tRoot.has(r.labelKey) ? tRoot(r.labelKey) : r.name}</span>
                    {/* `pct` null = recurso `staff` sin turnos cargados (BE PR #518): sin techo humano,
                        no hay cuello de botella que medir — «—» en vez de inventar un porcentaje. */}
                    {r.summary.pct == null ? (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                          r.summary.pct >= 80 ? "bg-destructive/15 text-destructive"
                            : r.summary.pct >= 50 ? "bg-warning/20 text-warning-foreground"
                            : "bg-success/15 text-success-foreground",
                        )}
                        title={t("usedOf", { used: r.summary.used, available: r.summary.available ?? 0 })}
                      >
                        {r.summary.pct}%
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">·{t("cap", { n: r.capacity })}</span>
                  </div>
                </th>
                {occ.slots.map((s) => (
                  <td key={s} className="px-0.5 py-0.5 text-center">
                    <Cell cell={byTime.get(s)} tRoot={tRoot} isNow={s === horaAhora} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  cell,
  tRoot,
  isNow,
}: {
  cell: OccupancyCell | undefined;
  tRoot: { has: (k: string) => boolean; (k: string): string };
  isNow: boolean;
}) {
  if (!cell) return <span className="block h-6" />;
  // `free: null` = recurso `staff` sin turnos cargados (BE PR #518): sin techo, el motor tampoco la
  // cierra. Neutral, no "lleno": sería mentir que no cabe cuando lo que falta es el dato de turnos.
  if (cell.free == null) {
    return (
      <span className={cn("flex h-6 min-w-6 items-center justify-center rounded bg-muted/40 font-mono text-[11px] text-muted-foreground", isNow && "ring-1 ring-primary")}>
        —
      </span>
    );
  }
  const full = cell.free <= 0;
  const tone = !full
    ? "bg-success/15 text-success-foreground"
    : cell.cappedBy === "staff"
      ? "bg-warning/25 text-warning-foreground"
      : "bg-destructive/15 text-destructive";
  const reasonKey = full ? (cell.cappedBy === "staff" ? "therapies.noStaff" : "therapies.full") : null;
  // Solo en una sala de varios cargos (npt_room: técnico y enfermera, BE PR #519): el detalle por
  // cargo gana al motivo genérico — dice CUÁL cargo falta, no solo que falta alguno.
  const roleLabel = (role: string) => (tRoot.has(`resources.role.${role}`) ? tRoot(`resources.role.${role}`) : role);
  const title = cell.byRole?.length
    ? cell.byRole
        .map((b) => `${roleLabel(b.role)}: ${b.free}${b.free <= 0 ? ` (${tRoot("resources.role.noStaffShort")})` : ""}`)
        .join(" · ")
    : reasonKey && tRoot.has(reasonKey)
      ? tRoot(reasonKey)
      : "";
  return (
    <span
      title={title}
      className={cn(
        "flex h-6 min-w-6 items-center justify-center rounded font-mono text-[11px] font-medium tabular-nums",
        tone,
        isNow && "ring-1 ring-primary",
      )}
    >
      {full ? "·" : cell.free}
    </span>
  );
}
