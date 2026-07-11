"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";

import type { ColumnaEfectiva, CitaFila } from "@/lib/api/agenda-dia";
import type { Opcion, Transicion } from "@/lib/api/tablero";
import { useCan } from "@/hooks/use-can";
import { Badge } from "@/components/ui/badge";
import { CeldaSelect } from "@/components/tablero/celda-select";
import { CeldaToggleHora } from "@/components/tablero/celda-toggle-hora";
import { CeldaToggleIcon } from "@/components/tablero/celda-toggle-icon";
import { FlujoAtencion } from "@/components/tablero/flujo-atencion";

// Single renderer for the metadata-driven board (dynamic columns). Header per
// labelKey, cell per column `tipo`; the "accion" column becomes CitaActions.
// Shared by the call-center day-view and the Atención (AP) board so there's one
// dynamic-column implementation.

// Effective column colour: the user's personalization (render.color) wins over
// the admin's board colour (col.color). null = default styling.
export function colColor(col: ColumnaEfectiva): string | null {
  const r = col.render as Record<string, unknown> | null;
  const userColor = r && typeof r.color === "string" ? (r.color as string) : null;
  return userColor ?? col.color ?? null;
}

// Resumen de factura (tipo REUSABLE "factura"): el binding trae un objeto
// { numero, total, saldo, estado, modoPago, usuario }. Cualquier tablero de cita
// puede componer una columna tipo "factura" (p.ej. la columna "pago" de atención).
function FacturaCell({ value }: { value: unknown }) {
  const t = useTranslations("tableroBoard");
  const f = (value && typeof value === "object" ? value : null) as
    | { numero?: unknown; total?: unknown; saldo?: unknown; estado?: unknown; modoPago?: unknown; usuario?: unknown }
    | null;
  if (!f || (f.numero == null && !f.estado)) return <span className="text-muted-foreground">—</span>;
  const estado = String(f.estado ?? "");
  const tone =
    estado === "borrador" ? "#D97706" : estado === "anulada" ? "#E11D48" : "#15803D";
  const saldo = Number(f.saldo ?? 0);
  const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;
  const sub = [f.modoPago, f.usuario].map((x) => (x == null ? "" : String(x))).filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col gap-0.5 text-xs leading-tight">
      <div className="flex flex-wrap items-center gap-1.5">
        {estado && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 14%, transparent)` }}>
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </span>
        )}
        {f.numero != null && <span className="font-mono tabular-nums text-muted-foreground">F{String(f.numero)}</span>}
        {f.total != null && <span className="font-semibold tabular-nums">{money(f.total)}</span>}
      </div>
      {sub && <span className="truncate text-muted-foreground">{sub}</span>}
      {saldo > 0 && <span className="font-medium text-amber-600 dark:text-amber-400">{t("balance")}: {money(saldo)}</span>}
    </div>
  );
}

// Tipo de consulta como badge coloreado (render.kind="tipoConsulta"). Acepta objeto
// {clave,nombre,color} (ideal BE) o string (mínimo). Reusable en cualquier tablero.
function TipoConsultaCell({ value }: { value: unknown }) {
  const o = value && typeof value === "object" ? (value as { nombre?: unknown; color?: unknown }) : null;
  const nombre = o?.nombre != null ? String(o.nombre) : value != null && value !== "" ? String(value) : "";
  if (!nombre) return <span className="text-muted-foreground">—</span>;
  const color = o?.color ? String(o.color) : null;
  const style = color ? { color, borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` } : undefined;
  return <Badge variant="secondary" style={style}>{nombre}</Badge>;
}

// Fecha corta y legible (binding fecha, p.ej. cita.proxCita). null → "—".
function fmtFecha(v: unknown, locale: string): string {
  if (v == null || v === "") return "—";
  const s = String(v);
  const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
  return Number.isNaN(d.getTime())
    ? s
    : new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-PR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Puerto_Rico" }).format(d);
}

export function Cell({ col, value }: { col: ColumnaEfectiva; value: unknown }) {
  const locale = useLocale();
  const text = value == null || value === "" ? "—" : String(value);
  const kind = (col.render as Record<string, unknown> | null)?.kind;
  // Renderers especiales por DATO (render.kind), no por tipo → reusables sin tocar
  // el enum de tipos del BE.
  if (kind === "factura") return <FacturaCell value={value} />;
  if (kind === "tipoConsulta") return <TipoConsultaCell value={value} />;
  // Defensivo: un binding que resuelve a OBJETO NUNCA debe caer a "[object Object]".
  if (value != null && typeof value === "object") return <FacturaCell value={value} />;
  if (col.tipo === "fecha") return <span className="whitespace-nowrap tabular-nums">{fmtFecha(value, locale)}</span>;
  if (col.tipo === "badge") {
    // Color por-VALOR opcional (dato: render.valueColors {valor:hex}); si no, el
    // color fijo de la columna. Label humanizado (borrador → Borrador). Sin hardcode.
    const raw = value == null || value === "" ? "" : String(value);
    const valueColors = (col.render as Record<string, unknown> | null)?.valueColors as Record<string, string> | undefined;
    const c = (raw && valueColors?.[raw]) || colColor(col);
    const style = c
      ? { color: c, borderColor: c, backgroundColor: `color-mix(in srgb, ${c} 12%, transparent)` }
      : undefined;
    return <Badge variant="secondary" style={style}>{raw ? titleCase(raw) : "—"}</Badge>;
  }
  if (col.tipo === "accion") return <span className="text-muted-foreground">·</span>;
  if (col.tipo === "derivado") {
    return <span className="font-mono text-xs text-muted-foreground">{value == null || value === "" ? "—" : String(value)}</span>;
  }
  return <span className={col.tipo === "hora" ? "font-mono" : undefined}>{text}</span>;
}

const AVATAR_PALETTE = ["#0D9488", "#0284C7", "#7C3AED", "#D97706", "#15803D", "#E11D48", "#0891B2", "#4F46E5", "#DB2777"];
function avatarColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
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
  transiciones,
  estados,
  density,
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
  transiciones?: Transicion[];
  estados?: { clave: string; orden: number; color?: string | null }[];
  density?: "comodo" | "compacto";
}) {
  const tRoot = useTranslations();
  const cols = useVisibleColumns(columnas);
  const rowPad = density === "compacto" ? "py-1" : "py-2";

  function renderCell(col: ColumnaEfectiva, fila: CitaFila) {
    // Paciente: avatar de iniciales + nombre (como el mockup).
    if (col.clave === "paciente") {
      const nombre = fila[col.clave] == null ? "" : String(fila[col.clave]);
      const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
      return (
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: avatarColor(nombre) }}
          >
            {iniciales || "?"}
          </span>
          <span className="font-medium">{titleCase(nombre)}</span>
        </div>
      );
    }
    if (col.tipo === "accion") {
      return renderAccion?.(fila) ?? <Cell col={col} value={fila[col.clave]} />;
    }
    // Timed toggle (PRESENTE/EN CONSULTA/ASISTIDO): render.transition drives it.
    if (col.tipo === "toggle" && (col.render as Record<string, unknown> | null)?.transition && tablero) {
      return (
        <CeldaToggleHora
          tablero={tablero}
          entidadId={fila.id}
          estado={String(fila.estado ?? "")}
          col={col}
          value={fila[col.clave]}
          transiciones={transiciones ?? []}
          estados={estados ?? []}
          centroId={centroId}
          onSaved={onRefresh}
        />
      );
    }
    // Icon toggle of a PATIENT flag (render.icon + writeBinding, sin transición):
    // p.ej. "testimonio" → paciente.esTestimonio. Reusable por cualquier flag.
    if (col.tipo === "toggle" && (col.render as Record<string, unknown> | null)?.writeBinding) {
      return (
        <CeldaToggleIcon col={col} fila={fila} centroId={centroId} onSaved={onRefresh} />
      );
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

  // Encadenamiento CONFIGURABLE (dato): las columnas con el mismo `render.group`
  // se agrupan en una sola columna encadenada. El orden/dependencias salen de las
  // transiciones + orden de estados (en FlujoAtencion). Cero hardcode en el FE.
  type Group = { kind: "col"; col: ColumnaEfectiva } | { kind: "flow"; group: string; cols: ColumnaEfectiva[] };
  const groups: Group[] = [];
  for (const col of cols) {
    const groupName = (col.render as Record<string, unknown> | null)?.group as string | undefined;
    const last = groups[groups.length - 1];
    if (groupName && last && last.kind === "flow" && last.group === groupName) last.cols.push(col);
    else groups.push(groupName ? { kind: "flow", group: groupName, cols: [col] } : { kind: "col", col });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {groups.map((g, gi) =>
              g.kind === "flow" ? (
                <th key={`flow-${gi}`} className="px-3 py-2 text-center font-medium whitespace-nowrap">
                  {tRoot("tableroBoard.flowTitle")}
                </th>
              ) : (
                <th key={g.col.clave} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {(() => {
                    const c = colColor(g.col);
                    return (
                      <span className="inline-flex items-center gap-1.5" style={c ? { color: c } : undefined}>
                        {c && <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: c }} />}
                        {tRoot(g.col.labelKey)}
                      </span>
                    );
                  })()}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td colSpan={groups.length} className="px-3 py-6 text-center text-muted-foreground">
                {emptyLabel ?? "—"}
              </td>
            </tr>
          )}
          {filas.map((fila) => {
            const rowColor = estados?.find((e) => e.clave === String(fila.estado ?? ""))?.color ?? null;
            return (
              <tr key={fila.id} className="border-t transition-colors hover:bg-muted/40">
                {groups.map((g, gi) =>
                  g.kind === "flow" ? (
                    <td key={`flow-${gi}`} className={"px-3 " + rowPad}>
                      <FlujoAtencion
                        tablero={tablero ?? ""}
                        fila={fila}
                        cols={g.cols}
                        transiciones={transiciones ?? []}
                        estados={estados ?? []}
                        centroId={centroId}
                        onSaved={onRefresh}
                      />
                    </td>
                  ) : (
                    <td
                      key={g.col.clave}
                      className={"px-3 whitespace-nowrap " + rowPad}
                      style={gi === 0 && rowColor ? { boxShadow: `inset 3px 0 0 ${rowColor}` } : undefined}
                    >
                      {renderCell(g.col, fila)}
                    </td>
                  ),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
