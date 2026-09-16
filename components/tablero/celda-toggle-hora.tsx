"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ejecutarAccion, type Transicion } from "@/lib/api/tablero";
import type { ColumnaEfectiva } from "@/lib/api/agenda-dia";
import { resolveToggle, type EstadoLite } from "@/lib/tablero/toggle-hora";
import { colColor } from "@/components/agenda/tablero-dinamico";
import { toastError } from "@/lib/api/errors";
import { Checkbox } from "@/components/ui/checkbox";

// Formats a sealed timestamp to HH:MM in the clinic timezone (America/Puerto_Rico).
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

// PRESENTE / EN CONSULTA / ASISTIDO. FUNCIÓN PRIMARIA: un CHECK que PONE o QUITA.
// Marcar = ejecuta la transición hacia adelante (render.transition) y de paso
// sella la hora (beneficio). Desmarcar = ejecuta el reverso de ESTA etapa.
// La decisión (qué acción mandar) vive en lib/tablero/toggle-hora.ts (pura, testeada):
// blinda el bug atencion-la-segunda-casilla-deshace-la-primera. Optimista = reacciona al
// instante; SSE + servidor reconcilian. Guardas del BE (p.ej. requiere médico).
export function CeldaToggleHora({
  tablero,
  entidadId,
  estado,
  col,
  value,
  transiciones,
  estados,
  centroId,
  onSaved,
}: {
  tablero: string;
  entidadId: string;
  estado: string;
  col: ColumnaEfectiva;
  value: unknown;
  transiciones: Transicion[];
  estados: EstadoLite[];
  centroId?: string;
  onSaved?: () => void;
}) {
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);
  // Override optimista del "marcado" (true/false); undefined = usa el estado real.
  const [optimistic, setOptimistic] = React.useState<boolean | undefined>(undefined);
  const color = colColor(col);

  const transClave = (col.render as Record<string, unknown> | null)?.transition as string | undefined;

  // Decisión PURA (marcado/deshabilitado/acción a ejecutar), testeada en lib/tablero/toggle-hora.
  // `action` ya es no-op cuando la casilla no puede avanzar ni deshacer → jamás manda el back de otra etapa.
  const { checked, disabled, action } = resolveToggle({
    estado,
    forwardSlug: transClave,
    transiciones,
    estados,
    optimistic,
    busy,
  });
  const hora = checked ? fmtHora(value) : null; // la hora sellada es el BENEFICIO

  async function toggle() {
    if (!action) return; // no-op seguro
    setBusy(true);
    setOptimistic(!checked); // PONER / QUITAR al instante
    try {
      await ejecutarAccion({ boardSlug: tablero, entityId: entidadId, action }, centroId);
      onSaved?.();
    } catch (err) {
      setOptimistic(undefined); // revertir
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  const style = checked && color ? ({ "--tw-ring-color": color } as React.CSSProperties) : undefined;

  return (
    <label
      className={
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-colors " +
        (checked
          ? "border-transparent bg-primary text-primary-foreground"
          : disabled
            ? "cursor-not-allowed border-dashed border-muted-foreground/30 text-muted-foreground/40"
            : "border-input text-muted-foreground hover:border-primary hover:text-primary")
      }
      style={checked && color ? { backgroundColor: color, color: "#fff" } : style}
      title={tRoot(col.labelKey)}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={toggle}
        className={checked ? "border-white/70 data-[state=checked]:bg-white/20 data-[state=checked]:text-white" : ""}
      />
      {hora && <span className="font-mono">{hora}</span>}
    </label>
  );
}
