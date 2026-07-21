"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  getColumnasCatalogo,
  getColumnasEfectivas,
  setComposicionBulk,
  personalizarColumna,
  type ColumnaCatalogo,
} from "@/lib/api/tablero";
import type { ColumnaEfectiva } from "@/lib/api/agenda-dia";
import { toBlocks, moveBlock, flatten, normalize } from "@/lib/tablero/column-blocks";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// Generic column builder for ANY board (tablero key). Pick which columns show and
// in what order. Board-level (needs tablero.config) → composición/bulk; otherwise
// personalizes the user's own view. This is the "configure, not code" brick.
export function TableroEditor({ tablero }: { tablero: string }) {
  const t = useTranslations("tableroEditor");
  const tc = useTranslations("common");

  const catRes = useResource<ColumnaCatalogo[]>(() => getColumnasCatalogo(tablero), [tablero]);
  const effRes = useResource<ColumnaEfectiva[]>(() => getColumnasEfectivas(tablero), [tablero]);
  const loading = catRes.state.kind === "loading" || effRes.state.kind === "loading";
  const catalog = catRes.state.kind === "ok" ? catRes.state.data : [];
  const efectivas = effRes.state.kind === "ok" ? effRes.state.data : [];

  const sig = catalog.map((c) => c.id).join(",") + "|" + efectivas.map((e) => `${e.clave}:${e.orden}`).join(",");

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/citas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          {tc("back")}
        </Link>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Badge variant="secondary" className="ml-1">{tablero}</Badge>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("help")}</p>

      {loading && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
      {!loading && (
        <Editor
          key={sig}
          tablero={tablero}
          catalog={catalog}
          efectivas={efectivas}
          onSaved={() => {
            catRes.reload();
            effRes.reload();
          }}
        />
      )}
    </div>
  );
}

type Row = {
  columnaId: string;
  clave: string;
  labelKey: string;
  tipo: string;
  visible: boolean;
  fijo: boolean;
  // Encadenamiento data-driven (BE render.group): columnas con el mismo group se mueven en bloque.
  group: string | null;
};

function buildRows(catalog: ColumnaCatalogo[], efectivas: ColumnaEfectiva[]): Row[] {
  const eff = new Map(efectivas.map((e) => [e.clave, e]));
  const rows: (Row & { orden: number })[] = catalog.map((c) => {
    const e = eff.get(c.clave);
    return {
      columnaId: c.id,
      clave: c.clave,
      labelKey: c.labelKey,
      tipo: c.tipo,
      visible: !!e,
      fijo: !!e?.fijo,
      // `render` viene tipado como Record opaco → leemos group de forma segura (sin hardcodear claves).
      group: (c.render as { group?: string | null } | null)?.group ?? null,
      orden: e?.orden ?? 9999,
    };
  });
  rows.sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave));
  // normalize junta grupos partidos en su 1ª aparición → el editor nunca muestra un bloque roto.
  return normalize(
    rows.map((r) => ({
      columnaId: r.columnaId,
      clave: r.clave,
      labelKey: r.labelKey,
      tipo: r.tipo,
      visible: r.visible,
      fijo: r.fijo,
      group: r.group,
    })),
  );
}

function Editor({
  tablero,
  catalog,
  efectivas,
  onSaved,
}: {
  tablero: string;
  catalog: ColumnaCatalogo[];
  efectivas: ColumnaEfectiva[];
  onSaved: () => void;
}) {
  const t = useTranslations("tableroEditor");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  const boardMode = can("tablero.config"); // else: personalize own view
  const [rows, setRows] = React.useState<Row[]>(() => buildRows(catalog, efectivas));
  const [saving, setSaving] = React.useState(false);

  // El orden se maneja por BLOQUES (grupos encadenados se mueven juntos): mover un miembro mueve todo el
  // bloque. Al guardar se envía flatten() ya contiguo (el BE re-normaliza igual, pero la vista no engaña).
  const blocks = React.useMemo(() => toBlocks(rows), [rows]);

  function moveBlk(blockIndex: number, dir: -1 | 1) {
    setRows((rs) => flatten(moveBlock(toBlocks(rs), blockIndex, dir)));
  }
  function patch(columnaId: string, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.columnaId === columnaId ? { ...r, ...p } : r)));
  }

  async function save() {
    setSaving(true);
    try {
      if (boardMode) {
        await setComposicionBulk(
          tablero,
          rows.map((r, i) => ({ columnaId: r.columnaId, orden: i, visible: r.visible, fijo: r.fijo, activo: true })),
        );
      } else {
        await Promise.all(
          rows.map((r, i) =>
            personalizarColumna({ tablero, columnaId: r.columnaId, visible: r.visible, orden: i, fijo: r.fijo }),
          ),
        );
      }
      toast.success(t("saved"));
      onSaved();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {boardMode ? t("boardMode") : t("personalMode")}
      </p>

      <ul className="space-y-2">
        {blocks.map((b, bi) => {
          const mover = (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => moveBlk(bi, -1)}
                disabled={bi === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={t("moveUp")}
              >
                <HugeiconsIcon icon={ArrowUp01Icon} className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => moveBlk(bi, 1)}
                disabled={bi === blocks.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={t("moveDown")}
              >
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
              </button>
            </div>
          );

          const itemRow = (r: Row) => (
            <div key={r.columnaId} className={"flex items-center gap-3 " + (r.visible ? "" : "opacity-50")}>
              <label className="flex flex-1 cursor-pointer items-center gap-2">
                <Checkbox checked={r.visible} onCheckedChange={(v) => patch(r.columnaId, { visible: v === true })} />
                <span className="text-sm font-medium">{tRoot(r.labelKey)}</span>
                <span className="text-xs text-muted-foreground">· {r.clave}</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox checked={r.fijo} onCheckedChange={(v) => patch(r.columnaId, { fijo: v === true })} />
                {t("pinned")}
              </label>
            </div>
          );

          // Bloque encadenado (2+ columnas con el mismo group): tarjeta con badge + un solo control de mover.
          if (b.group && b.items.length > 1) {
            return (
              <li key={`g-${b.group}`} className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <div className="flex items-center gap-3">
                  {mover}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{t("chained")}</Badge>
                      <span className="text-[11px] text-muted-foreground">{t("chainedHint")}</span>
                    </div>
                    <div className="space-y-1.5">{b.items.map(itemRow)}</div>
                  </div>
                </div>
              </li>
            );
          }

          // Fila suelta (o grupo de 1): tarjeta simple.
          const r = b.items[0];
          return (
            <li key={r.columnaId} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              {mover}
              <div className="flex-1">{itemRow(r)}</div>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? tc("saving") : tc("save")}
        </Button>
      </div>
    </div>
  );
}
