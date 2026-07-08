"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getDefinicion,
  getColumnasCatalogo,
  getModalModulos,
  setComposicionRender,
  type TableroDefinicion,
  type ColumnaCatalogo,
  type ModalModulo,
} from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { Switch } from "@/components/ui/switch";

// Módulos pluggables del modal de post-acción, POR TABLERO. La LISTA de módulos
// viene del catálogo del BE (GET /tablero/modal/modulos?postAccion=, BE-3); el
// estado plugged/unplugged por-tablero se guarda en el OVERRIDE de render de la
// composición (`render.<clave>=false` = desconectado; ausente = enchufado). BE ya
// fusiona render por-tablero. Ver docs/specs/prescripcion-obligatoria-y-modulos-modal-fe-request.md

// Solo los overrides de composición (los que difieren del catálogo). Así el toggle
// preserva `postAccion` (override) sin congelar `group/transition/estampa` (catálogo).
function diffRender(
  merged: Record<string, unknown> | null,
  cat: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged ?? {})) {
    if (JSON.stringify(cat?.[k]) !== JSON.stringify(v)) out[k] = v;
  }
  return out;
}

export function ModalModulosConfig({ tablero, centroId }: { tablero: string; centroId?: string }) {
  const t = useTranslations("modalModulos");
  const tRoot = useTranslations();
  const [def, setDef] = React.useState<TableroDefinicion | null>(null);
  const [cat, setCat] = React.useState<ColumnaCatalogo[]>([]);
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  // La composición (render override) es POR-CENTRO → leer/escribir con centroId.
  const fetchData = React.useCallback(() => {
    return Promise.all([getDefinicion(tablero, centroId), getColumnasCatalogo(tablero)])
      .then(([d, c]) => {
        setDef(d);
        setCat(c);
      })
      .catch(() => {});
  }, [tablero, centroId]);
  React.useEffect(() => {
    let active = true;
    fetchData().finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, [fetchData]);

  // Columna que dispara el modal = la que tiene render.postAccion (merged).
  const modalCol = def?.columnas.find((c) => (c.render as Record<string, unknown> | null)?.postAccion);
  const catCol = modalCol ? cat.find((c) => c.clave === modalCol.clave) : undefined;
  const mergedRender = (modalCol?.render as Record<string, unknown> | null) ?? null;
  const catRender = ((catCol?.render as Record<string, unknown> | null) ?? null);
  const postAccion = (mergedRender?.postAccion as string | undefined) ?? "";

  // Lista de módulos (catálogo BE) para ese postAccion.
  const [modulos, setModulos] = React.useState<ModalModulo[]>([]);
  React.useEffect(() => {
    if (!postAccion) return;
    let active = true;
    getModalModulos(postAccion)
      .then((m) => active && setModulos(m))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [postAccion]);

  async function toggle(key: string, enabled: boolean) {
    if (!catCol) return;
    const base = diffRender(mergedRender, catRender); // preserva postAccion
    const next = { ...base };
    if (enabled) delete next[key];
    else next[key] = false;
    setBusy(key);
    try {
      await setComposicionRender(tablero, catCol.id, next, centroId);
      toast.success(t("saved"));
      await fetchData();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (!modalCol) return <p className="text-sm text-muted-foreground">{t("noModal")}</p>;

  return (
    <div className="space-y-3">
      {modulos.length === 0 && <p className="text-sm text-muted-foreground">{t("noModules")}</p>}
      {modulos.map((m) => {
        const enabled = mergedRender?.[m.clave] !== false;
        return (
          <div key={m.clave} className="flex items-center gap-4 rounded-xl border bg-card/60 p-4 shadow-sm">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
              {tRoot(m.labelKey).charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{tRoot(m.labelKey)}</p>
              <p className="text-xs text-muted-foreground">{tRoot(m.descripcionKey)}</p>
            </div>
            <Switch
              checked={enabled}
              disabled={busy === m.clave}
              onCheckedChange={(v) => toggle(m.clave, v)}
              aria-label={tRoot(m.labelKey)}
            />
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
