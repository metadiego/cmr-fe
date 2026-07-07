"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ejecutarAccion, type Transicion } from "@/lib/api/tablero";
import type { ColumnaEfectiva } from "@/lib/api/agenda-dia";
import { colColor } from "@/components/agenda/tablero-dinamico";
import { toastError } from "@/lib/api/errors";

// Formats a sealed timestamp to HH:MM in the clinic timezone (America/Puerto_Rico).
// Falls back to any "HH:MM" it can find, else the raw string.
function fmtHora(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("es-PR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Puerto_Rico",
    }).format(d);
  }
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : s;
}

// A timed toggle (PRESENTE / EN CONSULTA / ASISTIDO). Data-driven from the column
// `render = { transition, estampa }`: the projected value is the sealed hour
// (cita.llegadaEn/horaInEn/horaOutEn). If set → show the hour. If not and the
// transition is currently allowed → a clickable check that fires the transition
// via POST /tablero/accion (BE enforces requierePrevios like medicoId). SSE +
// onSaved refresh the row.
export function CeldaToggleHora({
  tablero,
  entidadId,
  estado,
  col,
  value,
  transiciones,
  centroId,
  onSaved,
}: {
  tablero: string;
  entidadId: string;
  estado: string;
  col: ColumnaEfectiva;
  value: unknown;
  transiciones: Transicion[];
  centroId?: string;
  onSaved?: () => void;
}) {
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);

  const hora = fmtHora(value);
  const transClave = (col.render as Record<string, unknown> | null)?.transition as string | undefined;
  const trans = transClave ? transiciones.find((t) => t.clave === transClave) : undefined;
  const canFire = !!trans && (trans.desdeEstados.length === 0 || trans.desdeEstados.includes(estado));
  const color = colColor(col);

  async function fire() {
    if (!trans) return;
    setBusy(true);
    try {
      await ejecutarAccion({ tablero, entidadId, accion: trans.clave }, centroId);
      onSaved?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  // Sellado: pastilla llena con la hora + check (como el botón azul del legacy).
  if (hora) {
    const style = color
      ? { backgroundColor: color, color: "#fff" }
      : undefined;
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-xs font-semibold text-primary-foreground"
        style={style}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-3"><path d="M20 6 9 17l-5-5" /></svg>
        {hora}
      </span>
    );
  }

  // Disponible: botón claramente clicable (borde + hover que se llena).
  if (canFire) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={fire}
        title={tRoot(col.labelKey)}
        aria-label={tRoot(col.labelKey)}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M20 6 9 17l-5-5" /></svg>
        {tRoot(col.labelKey)}
      </button>
    );
  }

  // Aún no disponible (falta un paso previo).
  return <span className="text-muted-foreground/40">·</span>;
}
