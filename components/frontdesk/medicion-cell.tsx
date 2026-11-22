"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { FrontdeskColumna, Sesion } from "@/lib/api/frontdesk";
import { getSessionSheet } from "@/lib/api/frontdesk-sheet";
import { Input } from "@/components/ui/input";

// Celda de MEDICIÓN (número con unidad, p. ej. aplicadas/cantidad): auto-guarda mientras se edita
// (debounced) sin esperar el blur. Extraído de fila-sesion.tsx.
//
// APLICADAS (BE PR #598, handoff laser-sesion-del-dia-y-areas): si la visita no tiene nada guardado
// todavía, se precarga `sheet.areas` de la hoja de la visita como valor PROPUESTO (visible, editable,
// marcado con un halo + tooltip) — nunca se escribe solo por abrir el tablero: recién se guarda cuando
// el usuario confirma (sale del campo) o lo edita, igual que cualquier otro valor tecleado a mano.
export function MedicionCell({
  col,
  sesion,
  sessionId,
  centroId,
  disabled,
  onSave,
  onPending,
}: {
  col: FrontdeskColumna;
  sesion?: Sesion;
  sessionId?: string;
  centroId?: string;
  disabled: boolean;
  onSave: (valor: number) => void;
  /** The value SHOWN but not saved yet (proposal or typed), or null: a transition saves it first. */
  onPending?: (dato: string, valor: number | null) => void;
}) {
  const tRoot = useTranslations();
  const r = (col.render ?? {}) as { dato?: string; unidadKey?: string; min?: number; max?: number; paso?: number };
  const dato = r.dato ?? col.clave;
  const actual = (sesion?.data as Record<string, unknown> | null | undefined)?.[dato];

  const [propuesto, setPropuesto] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (dato !== "aplicadas" || actual != null || propuesto != null || !sessionId) return;
    getSessionSheet(sessionId, centroId)
      .then((h) => setPropuesto(h.areas ?? null))
      .catch(() => {});
  }, [dato, actual, propuesto, sessionId, centroId]);

  const fuente = actual ?? (propuesto != null ? propuesto : undefined);
  const [val, setVal] = React.useState(fuente != null ? String(fuente) : "");
  // SINCRONIZAR con el valor persistido (o el propuesto, mientras no haya nada persistido) cuando
  // cambia — patrón "ajustar estado al cambiar la prop". Antes `val` se fijaba una sola vez y quedaba
  // vacío aunque el BE tuviera el dato → parecía que "no persistía". No se pisa lo que el usuario está
  // escribiendo (solo si el input NO está enfocado).
  const [visto, setVisto] = React.useState(fuente);
  const [focused, setFocused] = React.useState(false);
  if (fuente !== visto && !focused) {
    setVisto(fuente);
    setVal(fuente != null ? String(fuente) : "");
  }
  const esPropuesto = actual == null && propuesto != null && val === String(propuesto);

  // Tell the row what is visible but unsaved, so «Asistido» counts it instead of blocking on a number the
  // user can see (lib/frontdesk/transition-fields.ts). Once saved, `actual` is set and this reports null.
  const pendiente = actual == null && val !== "" && !Number.isNaN(Number(val)) ? Number(val) : null;
  React.useEffect(() => { onPending?.(dato, pendiente); }, [onPending, dato, pendiente]);

  const commit = () => {
    setFocused(false);
    const n = Number(val);
    if (val === "" || Number.isNaN(n)) return;
    if (actual != null && Number(actual) === n) return;
    onSave(n);
  };

  // Auto-guardado (debounced) MIENTRAS se edita: el valor persiste sin depender del blur, así "escribo el
  // número y ya queda guardado" (y Asistido deja de bloquear por un dato que el usuario sí puso). onSave por
  // ref para no re-disparar el efecto en cada render. Solo si cambió y es válido.
  const onSaveRef = React.useRef(onSave);
  React.useEffect(() => { onSaveRef.current = onSave; });
  React.useEffect(() => {
    if (!focused) return;
    const n = Number(val);
    if (val === "" || Number.isNaN(n) || (actual != null && Number(actual) === n)) return;
    const h = setTimeout(() => onSaveRef.current(n), 700);
    return () => clearTimeout(h);
  }, [val, focused, actual]);

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="number"
        value={val}
        min={r.min}
        max={r.max}
        step={r.paso ?? 1}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        className={"h-7 w-20 text-right tabular-nums" + (esPropuesto ? " border-dashed text-muted-foreground" : "")}
        aria-label={tRoot(col.labelKey)}
        title={esPropuesto ? tRoot("frontdesk.aplicadasPropuesto") : undefined}
      />
      {r.unidadKey && <span className="text-xs text-muted-foreground">{tRoot(r.unidadKey)}</span>}
    </span>
  );
}
