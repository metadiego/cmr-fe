"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { ColumnaEfectiva, CitaFila } from "@/lib/api/agenda-dia";
import type { Opcion } from "@/lib/api/tablero";
import { useCan } from "@/hooks/use-can";
import { Badge } from "@/components/ui/badge";
import { CeldaSelect } from "@/components/tablero/celda-select";

// Single renderer for the metadata-driven board (dynamic columns). Header per
// labelKey, cell per column `tipo`; the "accion" column becomes CitaActions.
// Shared by the call-center day-view and the Atención (AP) board so there's one
// dynamic-column implementation.

export function Cell({ col, value }: { col: ColumnaEfectiva; value: unknown }) {
  const text = value == null || value === "" ? "—" : String(value);
  if (col.tipo === "badge") {
    const style = col.color
      ? { color: col.color, borderColor: col.color, backgroundColor: `color-mix(in srgb, ${col.color} 12%, transparent)` }
      : undefined;
    return <Badge variant="secondary" style={style}>{text}</Badge>;
  }
  if (col.tipo === "accion") return <span className="text-muted-foreground">·</span>;
  return <span className={col.tipo === "hora" ? "font-mono" : undefined}>{text}</span>;
}

// Dedupe columns by clave (combined agenda repeats them) and drop ones the user
// lacks permission for.
export function useVisibleColumns(columnas: ColumnaEfectiva[]): ColumnaEfectiva[] {
  const { can } = useCan();
  const seen = new Set<string>();
  return columnas
    .filter((c) => (seen.has(c.clave) ? false : (seen.add(c.clave), true)))
    .filter((c) => !c.permiso || can(c.permiso));
}

export function TableroDinamico({
  columnas,
  filas,
  renderAccion,
  emptyLabel,
  // Editable-cell plumbing (optional; supplied by the generic board). Without
  // these, cells render read-only exactly as before.
  tablero,
  centroId,
  onRefresh,
  optionsByCol,
}: {
  columnas: ColumnaEfectiva[];
  filas: CitaFila[];
  // Renders the cell for the "accion" column (declarative actions per row).
  renderAccion?: (fila: CitaFila) => React.ReactNode;
  emptyLabel?: string;
  tablero?: string;
  centroId?: string;
  onRefresh?: () => void;
  optionsByCol?: Record<string, Opcion[]>;
}) {
  const tRoot = useTranslations();
  const cols = useVisibleColumns(columnas);

  function renderCell(col: ColumnaEfectiva, fila: CitaFila) {
    if (col.tipo === "accion") {
      return renderAccion?.(fila) ?? <Cell col={col} value={fila[col.clave]} />;
    }
    if (col.tipo === "select" && col.editable && tablero) {
      return (
        <CeldaSelect
          tablero={tablero}
          entidadId={fila.id}
          columna={col.clave}
          value={fila[col.clave]}
          options={optionsByCol?.[col.clave] ?? []}
          centroId={centroId}
          onSaved={onRefresh}
        />
      );
    }
    return <Cell col={col} value={fila[col.clave]} />;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {cols.map((col) => (
              <th key={col.clave} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5" style={col.color ? { color: col.color } : undefined}>
                  {col.color && (
                    <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                  )}
                  {tRoot(col.labelKey)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="px-3 py-6 text-center text-muted-foreground">
                {emptyLabel ?? "—"}
              </td>
            </tr>
          )}
          {filas.map((fila) => (
            <tr key={fila.id} className="border-t">
              {cols.map((col) => (
                <td key={col.clave} className="px-3 py-1.5 whitespace-nowrap">
                  {renderCell(col, fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
