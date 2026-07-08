"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getDefinicion,
  getColumnasCatalogo,
  setComposicionRender,
  type TableroDefinicion,
  type ColumnaCatalogo,
} from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { Switch } from "@/components/ui/switch";

// Módulos pluggables del modal de post-acción, POR TABLERO. El estado
// plugged/unplugged se guarda en el OVERRIDE de render de la composición
// (`render.<modulo>=false` para desconectar; ausente = enchufado). BE ya fusiona
// render por-tablero. El registro de módulos es local por ahora (BE-3 pendiente:
// GET /tablero/modal/modulos). Ver docs/specs/prescripcion-obligatoria-y-modulos-modal-fe-request.md
const MODULOS: Array<{ key: string; icon: string }> = [{ key: "prescripcion", icon: "℞" }];

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
      {MODULOS.map((m) => {
        const enabled = mergedRender?.[m.key] !== false;
        return (
          <div key={m.key} className="flex items-center gap-4 rounded-xl border bg-card/60 p-4 shadow-sm">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
              {m.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t(`${m.key}.label`)}</p>
              <p className="text-xs text-muted-foreground">{t(`${m.key}.desc`)}</p>
            </div>
            <Switch
              checked={enabled}
              disabled={busy === m.key}
              onCheckedChange={(v) => toggle(m.key, v)}
              aria-label={t(`${m.key}.label`)}
            />
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
