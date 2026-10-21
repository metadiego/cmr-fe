"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import type { ColumnaEfectiva, TipoFranja, CitaFila } from "@/lib/api/agenda-dia";
import type { EstadoCitaCatalogo } from "@/lib/api/citas";
import type { Transicion } from "@/lib/api/tablero";
import { AhoraBadge } from "@/components/agenda/franja-resaltada";
import { tinteFila, esTipoNueva } from "@/lib/agenda/tinte-tipo";
import { cn } from "@/lib/utils";
import { Can } from "@/components/kit/can";
import { EstadoSelect } from "@/components/tablero/estado-select";
import { CeldaEditable } from "@/components/tablero/celda-editable";
import { AccionesModal, type AccionItem } from "@/components/tablero/acciones-modal";
import { Cell } from "@/components/agenda/tablero-dinamico";
import type { EhrGateCtx } from "@/components/tablero/flujo-atencion";

// A cita's cell: the SAME logic the classic and the new view both use (no duplication). Estado =
// inline selector; editable columns = CeldaEditable; accion = reserved; everything else = read-only Cell.
export function CeldaCita({
  col,
  fila,
  clinicId,
  estados,
  transiciones,
  editableClaves,
  onChanged,
  onEhrGate,
}: {
  col: ColumnaEfectiva;
  fila: CitaFila;
  clinicId: string;
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  editableClaves: Set<string>;
  onChanged: () => void;
  onEhrGate?: (ctx: EhrGateCtx) => void;
}) {
  const tRoot = useTranslations();
  const pacienteId = (fila as { pacienteId?: unknown }).pacienteId;
  return (
    <td className="px-3 py-1.5 whitespace-nowrap">
      {col.clave === "estado" ? (
        <EstadoSelect
          tablero="citas_cc"
          entidadId={fila.id}
          estado={String(fila.estado ?? fila["estado"] ?? "")}
          estados={estados}
          transiciones={transiciones}
          centroId={clinicId}
          pacienteId={pacienteId != null ? String(pacienteId) : undefined}
          onDone={onChanged}
          onEhrGate={onEhrGate}
        />
      ) : editableClaves.has(col.clave) ? (
        <CeldaEditable
          tablero="citas_cc"
          entidadId={fila.id}
          columna={col.clave}
          tipo={col.tipo}
          value={fila[col.clave]}
          centroId={clinicId}
          etiqueta={col.label ?? (tRoot.has(col.labelKey) ? tRoot(col.labelKey) : col.clave)}
          onChanged={onChanged}
        />
      ) : col.tipo === "accion" ? (
        // The call-center day agenda — always remember the call origin so a ficha opened from here can
        // jump straight back.
        <AccionesModal
          actions={((col.render as Record<string, unknown> | null)?.actions as AccionItem[] | undefined) ?? []}
          fila={fila}
          centroId={clinicId}
          saveOrigin
        />
      ) : col.clave === "paciente" ? (
        <span className="inline-flex items-center gap-1.5">
          <Cell col={col} value={fila[col.clave]} />
          <OrigenBadge fila={fila} />
        </span>
      ) : (
        <Cell col={col} value={fila[col.clave]} />
      )}
    </td>
  );
}

// Where the appointment came from, next to the patient: the call-center bridge (origenLegacy =
// 'scheduling-server', whatever its channel — rescheduled ones keep the bridge origin) or the app.
// The day view shows both since 13-oct-2026. Row keys stay Spanish in /api/v2 (`canal`, `origenLegacy`).
function OrigenBadge({ fila }: { fila: CitaFila }) {
  const t = useTranslations("agenda.dia");
  if (!("origenLegacy" in fila)) return null;
  const bridge = fila.origenLegacy === "scheduling-server";
  return (
    <span
      title={fila.canal ? t("origenCanal", { canal: String(fila.canal) }) : undefined}
      className={cn(
        "rounded px-1.5 py-px text-[10px] font-medium ring-1",
        bridge ? "bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300" : "bg-muted text-muted-foreground ring-foreground/10",
      )}
    >
      {t(bridge ? "origenCallCenter" : "origenApp")}
    </span>
  );
}

// One franja+tipo of the classic view: header (time, tipo, cupo, "now" highlight) + appointments
// table + free slots. Extracted out of dia-view.tsx to keep that file under its DEBT line ceiling.
// `cols` arrives already deduped and permission-filtered — the parent decides that once per render.
export function FranjaTipoSection({
  franja,
  tipo,
  cols,
  clinicId,
  estados,
  transiciones,
  editableClaves,
  onChanged,
  onAgendar,
  esAhora,
  onEhrGate,
}: {
  franja: { time: string | null };
  tipo: TipoFranja;
  cols: ColumnaEfectiva[];
  clinicId: string;
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  editableClaves: Set<string>;
  onChanged: () => void;
  onAgendar: (hora: string | null, tipo: TipoFranja) => void;
  esAhora: boolean;
  onEhrGate?: (ctx: EhrGateCtx) => void;
}) {
  const t = useTranslations("agenda");
  const tRoot = useTranslations();
  return (
    <section className={cn("space-y-1 rounded-md", esAhora && "bg-primary/5 ring-1 ring-primary/20 p-2 -m-2")}>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <span className="font-mono">{franja.time ?? t("dia.noTime")}</span>
        {esAhora && <AhoraBadge label={t("dia.now")} />}
        <span>{tipo.tipoNombre}</span>
        <span className="text-xs text-muted-foreground">
          {tipo.appointments.length}/{tipo.cupo}
        </span>
      </h3>
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {/* Ordinal 1/x (x = cupo de la hora): columna estrecha al inicio. */}
              <th className="w-10 px-2 py-1.5 text-left font-medium" aria-hidden />
              {cols.map((col) => (
                <th key={col.clave} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                  {tRoot(col.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tipo.appointments.map((fila, i) => (
              // Solo las citas de PACIENTE NUEVO se tiñen (las que más importan); el resto queda en blanco.
              // Handoff agenda-dia-el-color-del-tipo-tine-la-fila + ajuste del dueño (solo nuevas + ordinal).
              <tr
                key={fila.id}
                className="border-t"
                style={{ backgroundColor: esTipoNueva(tipo.tipoClave, tipo.tipoNombre) ? tinteFila(tipo.tipoColor) : undefined }}
              >
                {/* Posición dentro de la hora, sobre el total de cupos. */}
                <td className="px-2 py-1.5 text-[10px] tabular-nums text-muted-foreground">{i + 1}/{tipo.cupo}</td>
                {cols.map((col) => (
                  <CeldaCita
                    key={col.clave}
                    col={col}
                    fila={fila}
                    clinicId={clinicId}
                    estados={estados}
                    transiciones={transiciones}
                    editableClaves={editableClaves}
                    onChanged={onChanged}
                    onEhrGate={onEhrGate}
                  />
                ))}
              </tr>
            ))}
            {tipo.vacios > 0 && (
              <tr className="border-t bg-muted/10">
                <td colSpan={cols.length + 1} className="px-3 py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{t("dia.freeSlots", { n: tipo.vacios })}</span>
                    <Can permiso="citas.create">
                      <button
                        type="button"
                        onClick={() => onAgendar(franja.time, tipo)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                        {t("dia.book", { tipo: tipo.tipoNombre, hora: franja.time ?? "" })}
                      </button>
                    </Can>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
