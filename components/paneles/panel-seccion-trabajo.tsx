"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification03Icon, ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

import type { PanelSeccion, PanelPersonal, PanelEstatus, PanelWorkRow } from "@/lib/api/paneles";
import type { Servicio } from "@/lib/api/servicios";
import { rowsForSection, rowsForStaff, unclaimedRows } from "@/lib/panel/panel-trabajo";
import { fillableReportsFor } from "@/lib/panel/panel-formatos";
import { colorForName } from "@/lib/frontdesk/color";
import { StatusBadge } from "@/components/kit/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function horaDe(format: ReturnType<typeof useFormatter>, iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : format.dateTime(d, "time");
}

// Una sección del panel de trabajo del día (cmr-be #666): arriba lo que nadie ha tomado («Por tomar»,
// con campanita si la recepción ya tocó la alarma para esa fila), abajo una tarjeta por enfermera con
// SU lista de pacientes ya tomados en esta sección. Reemplaza al número-nada-más: ahora cada tarjeta
// trae contenido propio de la sección, así que repetirla por sección deja de ser puro relleno.
export function PanelSeccionTrabajo({
  seccion,
  rows,
  personal,
  estatusById,
  servicios,
  fillableSlugs,
  puedeOrdenar,
  dragId,
  overId,
  onDragStart,
  onDragEnd,
  onDragOverStaff,
  onDrop,
  onReordenar,
  onAbrirHoja,
  onTomar,
}: {
  seccion: PanelSeccion;
  rows: PanelWorkRow[];
  personal: PanelPersonal[];
  estatusById: ReadonlyMap<string, PanelEstatus>;
  servicios: readonly Servicio[];
  fillableSlugs: ReadonlySet<string>;
  puedeOrdenar: boolean;
  dragId: string | null;
  overId: string | null;
  onDragStart: (staffId: string) => void;
  onDragEnd: () => void;
  onDragOverStaff: (staffId: string) => void;
  onDrop: (staffId: string) => void;
  onReordenar: (staffId: string, delta: -1 | 1) => void;
  onAbrirHoja: (row: PanelWorkRow) => void;
  onTomar: (row: PanelWorkRow) => void;
}) {
  const t = useTranslations("panel");
  const tRoot = useTranslations();
  const format = useFormatter();
  const deEstaSeccion = rowsForSection(rows, seccion.clave);
  const porTomar = unclaimedRows(deEstaSeccion);

  if (!seccion.visible) {
    return <div className="h-3 w-full rounded" style={{ backgroundColor: seccion.color ?? undefined }} aria-hidden />;
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: seccion.color ?? undefined }} aria-hidden />
        <h2 className="text-lg font-semibold">{tRoot(seccion.labelKey)}</h2>
      </div>

      {porTomar.length > 0 && (
        <div className="mb-3 space-y-1.5 rounded-md border border-dashed border-foreground/15 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("work.toClaim")}</p>
          {porTomar.map((row) => (
            <div
              key={`${row.kind}:${row.sessionId ?? row.appointmentId}`}
              className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2.5 py-1.5 text-sm"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                {row.pendingNoticeId && <HugeiconsIcon icon={Notification03Icon} className="size-3.5 shrink-0 text-warning-foreground" aria-hidden />}
                <span className="truncate font-medium">{row.patientName ?? "—"}</span>
                {row.medicalRecordNumber && <span className="shrink-0 text-muted-foreground">· {row.medicalRecordNumber}</span>}
                <span className="shrink-0 text-muted-foreground tabular-nums">{horaDe(format, row.time)}</span>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => onTomar(row)}>
                {t("work.claim")}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {personal.map((p, i) => {
          const mias = rowsForStaff(deEstaSeccion, p.id);
          const est = estatusById.get(p.id);
          const pc = colorForName(p.name);
          return (
            <Card
              key={p.id}
              data-size="sm"
              draggable={puedeOrdenar}
              onDragStart={() => onDragStart(p.id)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => { if (puedeOrdenar && dragId) { e.preventDefault(); onDragOverStaff(p.id); } }}
              onDrop={() => onDrop(p.id)}
              className={
                "gap-1.5 px-3.5 " +
                (puedeOrdenar ? "cursor-grab " : "") +
                (overId === p.id && dragId ? "ring-2 ring-primary " : "") +
                (dragId === p.id ? "opacity-50" : "")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: pc }} aria-hidden />
                  <span className="truncate text-sm font-semibold text-foreground">{p.name}</span>
                </div>
                <span className="inline-grid h-6 min-w-[1.5rem] shrink-0 place-items-center rounded-full bg-muted px-1.5 text-xs font-bold tabular-nums text-muted-foreground">
                  {mias.length}
                </span>
              </div>
              {est && (est.labelKey || est.label) && (
                <span
                  className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={est.color ? { backgroundColor: `${est.color}22`, color: est.color } : undefined}
                >
                  {est.labelKey && tRoot.has(est.labelKey) ? tRoot(est.labelKey) : est.label}
                </span>
              )}
              {mias.length === 0 ? (
                <p className="py-0.5 text-xs text-muted-foreground">—</p>
              ) : (
                <ul className="divide-y divide-foreground/5 text-xs">
                  {mias.map((row) => {
                    const reports = row.kind === "session" && row.sessionId ? fillableReportsFor(row, servicios, fillableSlugs) : [];
                    const clickable = reports.length > 0;
                    return (
                      <li
                        key={`${row.kind}:${row.sessionId ?? row.appointmentId}`}
                        onClick={clickable ? () => onAbrirHoja(row) : undefined}
                        className={"flex items-center justify-between gap-2 py-1.5 " + (clickable ? "cursor-pointer hover:bg-muted" : "")}
                      >
                        <span className="min-w-0 truncate font-medium text-foreground">{row.patientName ?? "—"}</span>
                        <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-muted-foreground">
                          {horaDe(format, row.time)}
                          <StatusBadge kind={row.kind === "appointment" ? "appointment" : "therapy"} value={row.status} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {puedeOrdenar && (
                <div className="flex justify-end gap-1 border-t border-foreground/5 pt-1">
                  <button
                    type="button"
                    aria-label={t("staffOrder.up")}
                    disabled={i === 0}
                    onClick={() => onReordenar(p.id, -1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("staffOrder.down")}
                    disabled={i === personal.length - 1}
                    onClick={() => onReordenar(p.id, 1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
