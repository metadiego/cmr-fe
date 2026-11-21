"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification03Icon, ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

import type { PanelSeccion, PanelPersonal, PanelEstatus, PanelWorkRow } from "@/lib/api/paneles";
import type { Servicio } from "@/lib/api/servicios";
import { freeRowsForSection, rowsForStaffInSection, sectionVisibleForStaff } from "@/lib/panel/panel-trabajo";
import { fillableReportsFor } from "@/lib/panel/panel-formatos";
import { colorForName } from "@/lib/frontdesk/color";
import { StatusBadge } from "@/components/kit/status-badge";
import { Card } from "@/components/ui/card";

function horaDe(format: ReturnType<typeof useFormatter>, iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : format.dateTime(d, "time");
}

// Una tarjeta por enfermera (owner, 21-nov-2026, versión final tras el revert de «Por tomar»): los
// récords libres de cada sección van DENTRO de la tarjeta de la enfermera, los mismos en todas —
// tocar uno aquí se lo adjudica a ESTA enfermera directamente, sin diálogo intermedio. Una sección
// sin nada libre y sin nada de ella no ocupa espacio: no se pinta ni el renglón ni el cero.
export function PanelTarjetaEnfermera({
  persona,
  index,
  total,
  secciones,
  rows,
  est,
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
  persona: PanelPersonal;
  index: number;
  total: number;
  secciones: PanelSeccion[];
  rows: PanelWorkRow[];
  est?: PanelEstatus;
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
  onTomar: (row: PanelWorkRow, staffId: string) => void;
}) {
  const t = useTranslations("panel");
  const tRoot = useTranslations();
  const format = useFormatter();
  const pc = colorForName(persona.name);
  const seccionesVisibles = secciones.filter((s) => s.visible && sectionVisibleForStaff(rows, s.clave, persona.id));
  const totalMias = secciones.reduce((n, s) => n + rowsForStaffInSection(rows, s.clave, persona.id).length, 0);

  return (
    <Card
      data-size="sm"
      draggable={puedeOrdenar}
      onDragStart={() => onDragStart(persona.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { if (puedeOrdenar && dragId) { e.preventDefault(); onDragOverStaff(persona.id); } }}
      onDrop={() => onDrop(persona.id)}
      className={
        "gap-2 px-3.5 " +
        (puedeOrdenar ? "cursor-grab " : "") +
        (overId === persona.id && dragId ? "ring-2 ring-primary " : "") +
        (dragId === persona.id ? "opacity-50" : "")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: pc }} aria-hidden />
          <span className="truncate text-[15px] font-semibold text-foreground">{persona.name}</span>
        </div>
        <span
          className={
            "inline-grid h-7 min-w-[1.75rem] shrink-0 place-items-center rounded-full px-2 text-sm font-bold tabular-nums " +
            (totalMias > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
          }
        >
          {totalMias}
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

      {seccionesVisibles.length === 0 ? (
        <p className="py-0.5 text-xs text-muted-foreground">—</p>
      ) : (
        <div className="space-y-2">
          {seccionesVisibles.map((s) => {
            const libres = freeRowsForSection(rows, s.clave);
            const mias = rowsForStaffInSection(rows, s.clave, persona.id);
            return (
              <div key={s.clave} className="border-t border-foreground/5 pt-1.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="inline-block size-2 rounded-sm" style={{ backgroundColor: s.color ?? undefined }} aria-hidden />
                  {tRoot(s.labelKey)}
                </p>
                <ul className="divide-y divide-foreground/5 text-xs">
                  {mias.map((row) => {
                    const reports = row.kind === "session" && row.sessionId ? fillableReportsFor(row, servicios, fillableSlugs) : [];
                    const clickable = reports.length > 0;
                    return (
                      <li
                        key={`${row.kind}:${row.sessionId ?? row.appointmentId}`}
                        onClick={clickable ? () => onAbrirHoja(row) : undefined}
                        className={"flex items-center justify-between gap-2 py-1 " + (clickable ? "cursor-pointer hover:bg-muted" : "")}
                      >
                        <span className="min-w-0 truncate font-medium text-foreground">{row.patientName ?? "—"}</span>
                        <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-muted-foreground">
                          {horaDe(format, row.time)}
                          <StatusBadge kind={row.kind === "appointment" ? "appointment" : "therapy"} value={row.status} />
                        </span>
                      </li>
                    );
                  })}
                  {libres.map((row) => (
                    <li
                      key={`${row.kind}:${row.sessionId ?? row.appointmentId}`}
                      onClick={() => onTomar(row, persona.id)}
                      className="flex cursor-pointer items-center justify-between gap-2 py-1 text-primary hover:bg-primary/5"
                    >
                      <span className="flex min-w-0 items-center gap-1 truncate font-medium">
                        {row.pendingNoticeId && <HugeiconsIcon icon={Notification03Icon} className="size-3 shrink-0 text-warning-foreground" aria-hidden />}
                        {row.patientName ?? "—"}
                      </span>
                      <span className="shrink-0 tabular-nums">{horaDe(format, row.time)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {puedeOrdenar && (
        <div className="flex justify-end gap-1 border-t border-foreground/5 pt-1">
          <button
            type="button"
            aria-label={t("staffOrder.up")}
            disabled={index === 0}
            onClick={() => onReordenar(persona.id, -1)}
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={t("staffOrder.down")}
            disabled={index === total - 1}
            onClick={() => onReordenar(persona.id, 1)}
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
          </button>
        </div>
      )}
    </Card>
  );
}
