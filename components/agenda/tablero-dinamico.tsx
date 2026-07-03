"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { ColumnaEfectiva, CitaFila } from "@/lib/api/agenda-dia";
import { useCan } from "@/hooks/use-can";
import { Badge } from "@/components/ui/badge";

// Single renderer for the metadata-driven board (dynamic columns). Header per
// labelKey, cell per column `tipo`; the "accion" column becomes CitaActions.
// Shared by the call-center day-view and the Atención (AP) board so there's one
// dynamic-column implementation.

export function Cell({ col, value }: { col: ColumnaEfectiva; value: unknown }) {
  const text = value == null || value === "" ? "—" : String(value);
  if (col.tipo === "badge") return <Badge variant="secondary">{text}</Badge>;
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
}: {
  columnas: ColumnaEfectiva[];
  filas: CitaFila[];
  // Renders the cell for the "accion" column (declarative actions per row).
  renderAccion?: (fila: CitaFila) => React.ReactNode;
  emptyLabel?: string;
}) {
  const tRoot = useTranslations();
  const cols = useVisibleColumns(columnas);

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {cols.map((col) => (
              <th key={col.clave} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {tRoot(col.labelKey)}
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
                  {col.tipo === "accion" ? (
                    renderAccion?.(fila) ?? <Cell col={col} value={fila[col.clave]} />
                  ) : (
                    <Cell col={col} value={fila[col.clave]} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
