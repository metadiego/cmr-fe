"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ejecutarAccion, type Transicion } from "@/lib/api/tablero";
import type { ColumnaEfectiva, CitaFila } from "@/lib/api/agenda-dia";
import { colColor } from "@/components/agenda/tablero-dinamico";
import { toastError } from "@/lib/api/errors";
import { Checkbox } from "@/components/ui/checkbox";

function fmtHora(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("es-PR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Puerto_Rico" }).format(d);
  }
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : s;
}

type EstadoLite = { clave: string; orden: number; color?: string | null };

// "Flujo de atención": los toggles PRESENTE / EN CONSULTA / ASISTIDO como chips
// conectados. Fuente de verdad = los TIMESTAMPS sellados de cada etapa (no depende
// de `fila.estado`). Marca en orden (cada etapa exige la anterior) y desmarca EN
// ORDEN (LIFO: solo la última activa). Optimista; BE valida con sus guardas.
export function FlujoAtencion({
  tablero,
  fila,
  cols,
  transiciones,
  estados,
  centroId,
  onSaved,
}: {
  tablero: string;
  fila: CitaFila;
  cols: ColumnaEfectiva[];
  transiciones: Transicion[];
  estados: EstadoLite[];
  centroId?: string;
  onSaved?: () => void;
}) {
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [opt, setOpt] = React.useState<Record<string, boolean>>({});

  const ordenOf = (clave: string | null) => estados.find((e) => e.clave === clave)?.orden ?? 0;
  const fwdOf = (col: ColumnaEfectiva) => {
    const clave = (col.render as Record<string, unknown> | null)?.transition as string | undefined;
    return clave ? transiciones.find((t) => t.clave === clave) : undefined;
  };
  const isChecked = (col: ColumnaEfectiva) => opt[col.clave] ?? (fila[col.clave] != null && fila[col.clave] !== "");

  async function toggle(i: number) {
    const col = cols[i];
    const checked = isChecked(col);
    const fwd = fwdOf(col);
    let accion: string | undefined;
    if (!checked) {
      accion = fwd?.clave;
    } else if (i > 0) {
      // Volver a la etapa anterior (su estado destino).
      const prevTarget = fwdOf(cols[i - 1])?.aEstado ?? null;
      accion = transiciones.find((t) => t.aEstado === prevTarget && fwd && t.desdeEstados.includes(fwd.aEstado ?? ""))?.clave;
    } else {
      // Primera etapa: bajar por debajo de su estado destino.
      accion = fwd
        ? transiciones.find((t) => t.desdeEstados.includes(fwd.aEstado ?? "") && t.aEstado != null && ordenOf(t.aEstado) < ordenOf(fwd.aEstado))?.clave
        : undefined;
    }
    if (!accion) return;
    setBusy(col.clave);
    setOpt((o) => ({ ...o, [col.clave]: !checked }));
    try {
      await ejecutarAccion({ tablero, entidadId: fila.id, accion }, centroId);
      onSaved?.();
    } catch (err) {
      setOpt((o) => {
        const n = { ...o };
        delete n[col.clave];
        return n;
      });
      toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-center gap-1">
      {cols.map((col, i) => {
        const checked = isChecked(col);
        const hora = checked ? fmtHora(fila[col.clave]) : null;
        const prevOk = i === 0 || isChecked(cols[i - 1]);
        const nextChecked = i < cols.length - 1 && isChecked(cols[i + 1]);
        const canCheck = !checked && prevOk; // en orden hacia adelante
        const canUncheck = checked && !nextChecked; // en orden hacia atrás (LIFO)
        const disabled = busy === col.clave || (!checked && !canCheck) || (checked && !canUncheck);
        const color = colColor(col);
        return (
          <React.Fragment key={col.clave}>
            {i > 0 && <span className={"h-px w-4 shrink-0 " + (checked ? "bg-primary/50" : "bg-border")} aria-hidden />}
            <div className="flex flex-col items-center gap-1">
              <label
                title={tRoot(col.labelKey)}
                className={
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-colors " +
                  (checked
                    ? "border-transparent text-primary-foreground"
                    : disabled
                      ? "cursor-not-allowed border-dashed border-muted-foreground/30 text-muted-foreground/40"
                      : "cursor-pointer border-input text-muted-foreground hover:border-primary hover:text-primary")
                }
                style={checked ? { backgroundColor: color ?? "var(--primary)", color: "#fff" } : undefined}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => toggle(i)}
                  className={checked ? "border-white/70 data-[state=checked]:bg-white/20 data-[state=checked]:text-white" : ""}
                />
                {hora && <span className="font-mono">{hora}</span>}
              </label>
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{tRoot(col.labelKey)}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
