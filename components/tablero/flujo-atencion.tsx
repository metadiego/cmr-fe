"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ejecutarAccion, type Transicion } from "@/lib/api/tablero";
import type { ColumnaEfectiva, CitaFila } from "@/lib/api/agenda-dia";
import { resolveToggle } from "@/lib/tablero/toggle-hora";
import { colColor } from "@/components/agenda/tablero-dinamico";
import { toastError } from "@/lib/api/errors";
import { Checkbox } from "@/components/ui/checkbox";
import { PostAccionHost } from "@/components/tablero/post-accion";

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
  // Modal de post-acción (p.ej. "Nueva cita" al marcar asistido). La clave y la
  // config salen de `columna.render` (dato), enrutadas por PostAccionHost.
  const [postAccion, setPostAccion] = React.useState<{ accion: string; render: Record<string, unknown> | null } | null>(null);

  const ordenOf = (clave: string | null) => estados.find((e) => e.clave === clave)?.orden ?? 0;
  const fwdSlug = (col: ColumnaEfectiva) =>
    (col.render as Record<string, unknown> | null)?.transition as string | undefined;
  const fwdOf = (col: ColumnaEfectiva) => {
    const clave = fwdSlug(col);
    return clave ? transiciones.find((t) => t.slug === clave) : undefined;
  };
  // Color de cada etapa = color del estado destino (dato: def.estados). Da los
  // colores del mockup (presente/en consulta/asistido) sin hardcode.
  const colorOf = (col: ColumnaEfectiva) => estados.find((e) => e.clave === fwdOf(col)?.toStatus)?.color ?? colColor(col) ?? null;

  // Decisión de cada etapa vía la MISMA lógica pura y testeada que CeldaToggleHora
  // (lib/tablero/toggle-hora): una casilla solo manda SU avance o SU propio back (el reverso de su
  // etapa), y si no puede ni avanzar ni deshacer es no-op. Antes «En consulta» calculaba el back
  // desde el estado de la fila y podía deshacer «Presente» (handoff atencion-la-segunda-casilla).
  const estadoFila = String(fila.estado ?? "");
  const resolved = (col: ColumnaEfectiva) =>
    resolveToggle({
      estado: estadoFila,
      forwardSlug: fwdSlug(col),
      transiciones,
      estados,
      optimistic: opt[col.clave],
      busy: busy === col.clave,
    });

  // Orden de la cadena = orden del estado destino de cada etapa (dato, no la
  // composición). Así el encadenamiento respeta el flujo real.
  const orderedCols = [...cols].sort((a, b) => ordenOf(fwdOf(a)?.toStatus ?? null) - ordenOf(fwdOf(b)?.toStatus ?? null));

  async function toggle(col: ColumnaEfectiva, checked: boolean, action: string | null) {
    if (!action) return; // no-op seguro: la etapa no puede avanzar ni deshacer
    setBusy(col.clave);
    setOpt((o) => ({ ...o, [col.clave]: !checked }));
    try {
      await ejecutarAccion({ boardSlug: tablero, entityId: fila.id, action }, centroId);
      onSaved?.();
      // Tras avanzar (no al desmarcar), si la columna define un postAccion,
      // abrir su modal registrado (data-driven, no hardcode).
      if (!checked) {
        const r = col.render as Record<string, unknown> | null;
        const pa = r?.postAccion as string | undefined;
        if (pa) setPostAccion({ accion: pa, render: r });
      }
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
    <>
    <div className="flex items-center justify-center gap-1">
      {orderedCols.map((col, i) => {
        const { checked, disabled, action } = resolved(col);
        const hora = checked ? fmtHora(fila[col.clave]) : null;
        const color = colorOf(col);
        return (
          <React.Fragment key={col.clave}>
            {i > 0 && <span className={"h-px w-4 shrink-0 " + (checked ? "bg-primary/50" : "bg-border")} aria-hidden />}
            {/* Ancho FIJO por paso: así Presente/En consulta/Asistido quedan alineados en columna entre
                filas, sin importar que un paso tenga hora sellada (más ancho) y otro esté vacío. */}
            <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1">
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
                  onCheckedChange={() => toggle(col, checked, action)}
                  className={checked ? "border-white/70 data-[state=checked]:bg-white/20 data-[state=checked]:text-white" : ""}
                />
                {hora && <span className="font-mono">{hora}</span>}
              </label>
              <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{tRoot(col.labelKey)}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
    {postAccion && (
      <PostAccionHost
        postAccion={postAccion.accion}
        render={postAccion.render}
        tablero={tablero}
        fila={fila}
        centroId={centroId}
        onClose={() => setPostAccion(null)}
        onSaved={onSaved}
      />
    )}
    </>
  );
}
