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
      orden: e?.orden ?? 9999,
    };
  });
  rows.sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave));
  return rows.map((r) => ({
    columnaId: r.columnaId,
    clave: r.clave,
    labelKey: r.labelKey,
    tipo: r.tipo,
    visible: r.visible,
    fijo: r.fijo,
  }));
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

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    setRows((rs) => {
      const next = rs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function patch(i: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
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

      <ul className="divide-y rounded-md border">
        {rows.map((r, i) => (
          <li key={r.columnaId} className={"flex items-center gap-3 px-3 py-2 " + (r.visible ? "" : "opacity-50")}>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={t("moveUp")}
              >
                <HugeiconsIcon icon={ArrowUp01Icon} className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={t("moveDown")}
              >
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
              </button>
            </div>

            <label className="flex flex-1 cursor-pointer items-center gap-2">
              <Checkbox checked={r.visible} onCheckedChange={(v) => patch(i, { visible: v === true })} />
              <span className="text-sm font-medium">{tRoot(r.labelKey)}</span>
              <span className="text-xs text-muted-foreground">· {r.clave}</span>
            </label>

            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={r.fijo} onCheckedChange={(v) => patch(i, { fijo: v === true })} />
              {t("pinned")}
            </label>
          </li>
        ))}
      </ul>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? tc("saving") : tc("save")}
        </Button>
      </div>
    </div>
  );
}
