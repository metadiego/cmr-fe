"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import type { ColumnaEfectiva, TipoFranja } from "@/lib/api/agenda-dia";
import type { EstadoCitaCatalogo } from "@/lib/api/citas";
import type { Transicion } from "@/lib/api/tablero";
import { AhoraBadge } from "@/components/agenda/franja-resaltada";
import { cn } from "@/lib/utils";
import { Can } from "@/components/kit/can";
import { EstadoSelect } from "@/components/tablero/estado-select";
import { CeldaEditable } from "@/components/tablero/celda-editable";
import { Cell } from "@/components/agenda/tablero-dinamico";

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
}: {
  col: ColumnaEfectiva;
  fila: { id: string; estado?: string } & Record<string, unknown>;
  clinicId: string;
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  editableClaves: Set<string>;
  onChanged: () => void;
}) {
  const tRoot = useTranslations();
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
          onDone={onChanged}
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
      ) : col.tipo === "accion" ? null : (
        <Cell col={col} value={fila[col.clave]} />
      )}
    </td>
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
              {cols.map((col) => (
                <th key={col.clave} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                  {tRoot(col.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tipo.appointments.map((fila) => (
              <tr key={fila.id} className="border-t">
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
                  />
                ))}
              </tr>
            ))}
            {tipo.vacios > 0 && (
              <tr className="border-t bg-muted/10">
                <td colSpan={cols.length} className="px-3 py-1.5">
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
