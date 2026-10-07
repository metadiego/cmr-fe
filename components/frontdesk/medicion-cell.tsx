"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { FrontdeskColumna, Sesion } from "@/lib/api/frontdesk";
import { Input } from "@/components/ui/input";

// Celda de MEDICIÓN (número con unidad, p. ej. aplicadas/cantidad): auto-guarda mientras se edita
// (debounced) sin esperar el blur. Extraído de fila-sesion.tsx.
export function MedicionCell({
  col,
  sesion,
  disabled,
  onSave,
}: {
  col: FrontdeskColumna;
  sesion?: Sesion;
  disabled: boolean;
  onSave: (valor: number) => void;
}) {
  const tRoot = useTranslations();
  const r = (col.render ?? {}) as { dato?: string; unidadKey?: string; min?: number; max?: number; paso?: number };
  const dato = r.dato ?? col.clave;
  const actual = (sesion?.data as Record<string, unknown> | null | undefined)?.[dato];
  const [val, setVal] = React.useState(actual != null ? String(actual) : "");
  // SINCRONIZAR con el valor persistido cuando cambia (la sesión llega tarde por el fetch, o el board
  // se refresca tras guardar) — patrón "ajustar estado al cambiar la prop". Antes `val` se fijaba una
  // sola vez y quedaba vacío aunque el BE tuviera el dato → parecía que "no persistía". No se pisa lo
  // que el usuario está escribiendo (solo si el input NO está enfocado).
  const [visto, setVisto] = React.useState(actual);
  const [focused, setFocused] = React.useState(false);
  if (actual !== visto && !focused) {
    setVisto(actual);
    setVal(actual != null ? String(actual) : "");
  }

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
        className="h-7 w-20 text-right tabular-nums"
        aria-label={tRoot(col.labelKey)}
      />
      {r.unidadKey && <span className="text-xs text-muted-foreground">{tRoot(r.unidadKey)}</span>}
    </span>
  );
}
