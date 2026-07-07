"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getDefinicion,
  getColumnasCatalogo,
  personalizarColumna,
  type TableroDefinicion,
  type ColumnaCatalogo,
} from "@/lib/api/tablero";
import type { ColumnaEfectiva } from "@/lib/api/agenda-dia";
import { colColor } from "@/components/agenda/tablero-dinamico";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { readDensity, writeDensity, type Density } from "@/hooks/use-board-prefs";

const SWATCHES = ["#0D9488", "#0284C7", "#D97706", "#15803D", "#E11D48", "#7C3AED", "#64748B"];

// "Tu espacio de trabajo" — personalización POR USUARIO de un tablero. Vive en
// Settings (NO en la UI operativa del board). Color por columna se persiste con
// POST /tablero/personalizar (render.color) y gana sobre el color del admin; la
// densidad es preferencia de vista local. El fondo del board queda pendiente de
// BE (handoff 2ª ola, F).
export function PersonalizarTablero({ tablero }: { tablero: string }) {
  const t = useTranslations("tableroBoard");
  const tRoot = useTranslations();
  const defRes = useResource<TableroDefinicion>(() => getDefinicion(tablero), [tablero]);
  const catRes = useResource<ColumnaCatalogo[]>(() => getColumnasCatalogo());

  const idByClave = new Map<string, string>();
  if (catRes.state.kind === "ok") for (const c of catRes.state.data) idByClave.set(c.clave, c.id);
  const cols = defRes.state.kind === "ok" ? defRes.state.data.columnas.filter((c) => c.tipo !== "accion") : [];

  const [density, setDensity] = React.useState<Density>("comodo");
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of persisted pref
    setDensity(readDensity(tablero));
  }, [tablero]);
  function changeDensity(d: Density) {
    setDensity(d);
    writeDensity(tablero, d);
  }

  const [busy, setBusy] = React.useState<string | null>(null);
  async function setColor(col: ColumnaEfectiva, hex: string | null) {
    const id = idByClave.get(col.clave);
    if (!id) return;
    setBusy(col.clave);
    try {
      await personalizarColumna({ tablero, columnaId: id, render: { color: hex } });
      defRes.reload();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("density")}</p>
        <div className="flex gap-2">
          {(["comodo", "compacto"] as Density[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => changeDensity(d)}
              className={
                "flex-1 rounded-md border px-3 py-1.5 text-sm transition " +
                (density === d
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t(d === "comodo" ? "comfortable" : "compact")}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("colColor")}</p>
        {defRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
        <ul className="space-y-2.5">
          {cols.map((col) => {
            const c = colColor(col);
            return (
              <li key={col.clave} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{tRoot(col.labelKey)}</span>
                <div className="flex items-center gap-1">
                  {SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      disabled={busy === col.clave}
                      onClick={() => setColor(col, hex)}
                      title={hex}
                      aria-label={hex}
                      className={
                        "size-4 rounded-full border transition " +
                        (c === hex
                          ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                          : "border-border hover:scale-110")
                      }
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  {c && (
                    <button
                      type="button"
                      disabled={busy === col.clave}
                      onClick={() => setColor(col, null)}
                      title={t("reset")}
                      aria-label={t("reset")}
                      className="ml-1 text-sm leading-none text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">{t("bgSoon")}</p>
    </div>
  );
}
