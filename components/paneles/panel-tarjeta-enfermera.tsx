"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

import type { PanelSeccion, PanelPersonal, PanelEstatus, PanelContador, PanelWorkRow } from "@/lib/api/paneles";
import type { Servicio } from "@/lib/api/servicios";
import { freeRowsForSection, rowsForStaffInSection, sectionVisibleForStaff } from "@/lib/panel/panel-trabajo";
import { fillableReportsFor } from "@/lib/panel/panel-formatos";
import { colorForName } from "@/lib/frontdesk/color";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Tinte suave (~12% alfa) a partir de un color hex del BE; si no es hex de 6 dígitos, sin tinte.
function tinteHex(color?: string | null): string | undefined {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}1f` : undefined;
}

// Una tarjeta por enfermera (VERSIÓN FINAL, owner 21-nov-2026, 11:55/11:57): la campana no cambia —
// esto es una SEGUNDA forma de trabajar. Cada chip con récords libres (solo secciones `selfClaim`,
// ej. GLP-1) los lista debajo, iguales en toda tarjeta — tocar uno se lo adjudica a ESTA enfermera.
// Cualquier chip (selfClaim o no) se puede tocar para ver los pacientes del día de esa enfermera en
// esa sección (así se llega también a los aceptados por campana — reemplaza «Aceptadas hoy»).
export function PanelTarjetaEnfermera({
  persona,
  index,
  total,
  secciones,
  rows,
  cont,
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
  cont?: PanelContador;
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
  const pc = colorForName(persona.name);
  const [seccionAbierta, setSeccionAbierta] = React.useState<string | null>(null);

  const seccionesVisibles = secciones.filter((s) => s.visible && sectionVisibleForStaff(rows, s.clave, persona.id));
  const seccionesSelfClaim = secciones.filter((s) => s.visible && s.selfClaim);
  const total_ = cont?.total ?? 0;

  function abrir(row: PanelWorkRow) {
    const reports = row.kind === "session" && row.sessionId ? fillableReportsFor(row, servicios, fillableSlugs) : [];
    if (reports.length > 0) onAbrirHoja(row);
  }

  return (
    <Card
      data-size="sm"
      draggable={puedeOrdenar}
      onDragStart={() => onDragStart(persona.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { if (puedeOrdenar && dragId) { e.preventDefault(); onDragOverStaff(persona.id); } }}
      onDrop={() => onDrop(persona.id)}
      className={
        "gap-2 px-4 " +
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
            (total_ > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
          }
        >
          {total_}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-foreground/5 pt-2">
        {seccionesVisibles.map((s) => {
          const nSec = cont?.bySection?.[s.clave] ?? 0;
          const tint = tinteHex(s.color);
          const misRows = rowsForStaffInSection(rows, s.clave, persona.id);
          return (
            <Popover key={s.clave} open={seccionAbierta === s.clave} onOpenChange={(o) => setSeccionAbierta(o ? s.clave : null)}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums transition-opacity hover:opacity-80 " +
                    (nSec > 0 ? (tint ? "" : "bg-primary/10 text-primary") : "bg-muted text-muted-foreground")
                  }
                  style={nSec > 0 && tint ? { backgroundColor: tint, color: s.color ?? undefined } : undefined}
                >
                  {tRoot(s.labelKey)} {nSec}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64">
                {misRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("sinPacientesHoy")}</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {misRows.map((row) => {
                      const clickable = row.kind === "session" && row.sessionId && fillableReportsFor(row, servicios, fillableSlugs).length > 0;
                      return (
                        <li
                          key={`${row.kind}:${row.sessionId ?? row.appointmentId}`}
                          onClick={clickable ? () => { abrir(row); setSeccionAbierta(null); } : undefined}
                          className={"truncate rounded px-1.5 py-1 " + (clickable ? "cursor-pointer hover:bg-muted" : "text-muted-foreground")}
                        >
                          {row.medicalRecordNumber ? `#${row.medicalRecordNumber} · ` : ""}
                          {row.patientName ?? "—"}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {seccionesSelfClaim.some((s) => freeRowsForSection(rows, s.clave).length > 0) && (
        <ul className="flex flex-col gap-1 border-t border-foreground/5 pt-2 text-left text-xs">
          {seccionesSelfClaim.flatMap((s) =>
            freeRowsForSection(rows, s.clave).map((row) => (
              <li
                key={`${row.kind}:${row.sessionId ?? row.appointmentId}`}
                onClick={() => onTomar(row, persona.id)}
                className="cursor-pointer truncate text-primary hover:underline"
              >
                {tRoot(s.labelKey)}
                {row.medicalRecordNumber ? ` · #${row.medicalRecordNumber}` : ""} · {row.patientName ?? "—"}
              </li>
            )),
          )}
        </ul>
      )}

      {est && (est.labelKey || est.label) && (
        <span
          className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={est.color ? { backgroundColor: `${est.color}22`, color: est.color } : undefined}
        >
          {est.labelKey && tRoot.has(est.labelKey) ? tRoot(est.labelKey) : est.label}
        </span>
      )}

      {puedeOrdenar && (
        <div className="flex justify-end gap-1 border-t border-foreground/5 pt-1.5">
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
