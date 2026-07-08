"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

import {
  getColumnasCatalogo,
  getColumnasEfectivas,
  getDefinicion,
  crearColumna,
  actualizarColumna,
  colorColumna,
  setComposicionBulk,
  personalizarColumna,
  type ColumnaCatalogo,
  type TableroDefinicion,
  type Transicion,
} from "@/lib/api/tablero";
import type { ColumnaEfectiva } from "@/lib/api/agenda-dia";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { ColumnConfigDialog } from "@/components/configuracion/column-config-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

// Superficie ÚNICA para gestionar las columnas de un tablero: agregar (del
// catálogo o crear), reordenar ↑/↓, visible/fija, color y configurar — todo en un
// lugar. Reusa el catálogo (ambitos) + composición (orden) + config por columna.
export function ColumnasTab({ clave }: { clave: string }) {
  const catRes = useResource<ColumnaCatalogo[]>(() => getColumnasCatalogo());
  const effRes = useResource<ColumnaEfectiva[]>(() => getColumnasEfectivas(clave), [clave]);
  const defRes = useResource<TableroDefinicion>(() => getDefinicion(clave), [clave]);
  const tc = useTranslations("common");

  const loading =
    catRes.state.kind === "loading" || effRes.state.kind === "loading" || defRes.state.kind === "loading";
  const catalog = (catRes.state.kind === "ok" ? catRes.state.data : []).filter((c) => c.activo);
  const efectivas = effRes.state.kind === "ok" ? effRes.state.data : [];
  const transiciones = defRes.state.kind === "ok" ? defRes.state.data.transiciones : [];

  function reloadAll() {
    catRes.reload();
    effRes.reload();
    defRes.reload();
  }

  // Firma para remontar el editor cuando cambia la membresía/orden del servidor.
  const sig =
    catalog.filter((c) => (c.ambitos ?? []).includes(clave)).map((c) => c.id).join(",") +
    "|" +
    efectivas.map((e) => `${e.clave}:${e.orden}`).join(",");

  if (loading) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  return (
    <ColumnasEditor
      key={sig}
      clave={clave}
      catalog={catalog}
      efectivas={efectivas}
      transiciones={transiciones}
      onChanged={reloadAll}
    />
  );
}

type Row = { columnaId: string; clave: string; labelKey: string; tipo: string; visible: boolean; fijo: boolean; group: string | null };

const renderGroup = (r: Record<string, unknown> | null | undefined) =>
  (r?.group as string | undefined) || null;

function buildRows(members: ColumnaCatalogo[], efectivas: ColumnaEfectiva[]): Row[] {
  const eff = new Map(efectivas.map((e) => [e.clave, e]));
  return members
    .map((c) => {
      const e = eff.get(c.clave);
      // group = override por-tablero (composición) o el del catálogo. Encadena.
      const group = renderGroup(e?.render) ?? renderGroup(c.render as Record<string, unknown> | null);
      return {
        columnaId: c.id,
        clave: c.clave,
        labelKey: c.labelKey,
        tipo: c.tipo,
        visible: !!e,
        fijo: !!e?.fijo,
        orden: e?.orden ?? 9999,
        group,
      };
    })
    .sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave))
    .map((r) => ({ columnaId: r.columnaId, clave: r.clave, labelKey: r.labelKey, tipo: r.tipo, visible: r.visible, fijo: r.fijo, group: r.group }));
}

// Agrupa filas CONTIGUAS del mismo `group` en bloques (cadenas). Un bloque se
// mueve como una sola unidad, manteniendo las columnas encadenadas juntas.
type Block = { group: string | null; items: Array<{ row: Row; index: number }> };
function toBlocks(rows: Row[]): Block[] {
  const blocks: Block[] = [];
  rows.forEach((row, index) => {
    const g = row.group || null;
    const last = blocks[blocks.length - 1];
    if (g && last && last.group === g) last.items.push({ row, index });
    else blocks.push({ group: g, items: [{ row, index }] });
  });
  return blocks;
}

function ColumnasEditor({
  clave,
  catalog,
  efectivas,
  transiciones,
  onChanged,
}: {
  clave: string;
  catalog: ColumnaCatalogo[];
  efectivas: ColumnaEfectiva[];
  transiciones: Transicion[];
  onChanged: () => void;
}) {
  const t = useTranslations("configuracion.tableros");
  const te = useTranslations("tableroEditor");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  const boardMode = can("tablero.config");

  const members = catalog.filter((c) => (c.ambitos ?? []).includes(clave));
  const nonMembers = catalog.filter((c) => !(c.ambitos ?? []).includes(clave));
  const catById = React.useMemo(() => new Map(catalog.map((c) => [c.id, c] as const)), [catalog]);

  const [rows, setRows] = React.useState<Row[]>(() => buildRows(members, efectivas));
  const [colors, setColors] = React.useState<Record<string, string | null>>(() =>
    Object.fromEntries(efectivas.map((e) => [e.clave, e.color ?? null])),
  );
  const [busy, setBusy] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [configCol, setConfigCol] = React.useState<ColumnaCatalogo | null>(null);

  // Mueve un BLOQUE completo (cadena o columna suelta) sobre el bloque contiguo,
  // preservando la contigüidad de las columnas encadenadas.
  function moveBlock(bi: number, dir: -1 | 1) {
    setRows((rs) => {
      const blocks = toBlocks(rs);
      const bj = bi + dir;
      if (bj < 0 || bj >= blocks.length) return rs;
      const arr = blocks.slice();
      [arr[bi], arr[bj]] = [arr[bj], arr[bi]];
      return arr.flatMap((b) => b.items.map((x) => x.row));
    });
  }
  function patch(i: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  }

  async function saveOrder() {
    setBusy(true);
    try {
      if (boardMode) {
        await setComposicionBulk(
          clave,
          rows.map((r, i) => ({ columnaId: r.columnaId, orden: i, visible: r.visible, fijo: r.fijo, activo: true })),
        );
      } else {
        await Promise.all(
          rows.map((r, i) => personalizarColumna({ tablero: clave, columnaId: r.columnaId, visible: r.visible, orden: i, fijo: r.fijo })),
        );
      }
      toast.success(te("saved"));
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  async function setColor(row: Row, color: string | null) {
    setBusyId(row.columnaId);
    setColors((c) => ({ ...c, [row.clave]: color }));
    try {
      await colorColumna(clave, row.columnaId, color);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusyId(null);
    }
  }

  // Agregar del catálogo: mete al tablero (ambitos) Y la compone visible al final
  // para que aparezca de inmediato (sin pasar por otra pantalla).
  async function agregar(cat: ColumnaCatalogo) {
    setBusyId(cat.id);
    try {
      await actualizarColumna(cat.id, { ambitos: [...(cat.ambitos ?? []), clave] });
      await setComposicionBulk(clave, [
        ...rows.map((r, i) => ({ columnaId: r.columnaId, orden: i, visible: r.visible, fijo: r.fijo, activo: true })),
        { columnaId: cat.id, orden: rows.length, visible: true, fijo: false, activo: true },
      ]);
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusyId(null);
    }
  }

  async function quitar(row: Row) {
    const cat = catById.get(row.columnaId);
    if (!cat) return;
    setBusyId(row.columnaId);
    try {
      await actualizarColumna(cat.id, { ambitos: (cat.ambitos ?? []).filter((a) => a !== clave) });
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusyId(null);
    }
  }

  const blocks = toBlocks(rows);

  // Contenido de una fila-columna (sin flechas: el orden lo maneja el bloque).
  const memberRow = (r: Row, i: number) => (
    <div className={"flex items-center gap-3 px-3 py-2 " + (r.visible ? "" : "opacity-50")}>
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox checked={r.visible} onCheckedChange={(v) => patch(i, { visible: v === true })} />
        <span className="text-sm font-medium">{tRoot(r.labelKey)}</span>
      </label>
      <span className="text-xs text-muted-foreground">· {r.clave} · {r.tipo}</span>
      <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
        <Checkbox checked={r.fijo} onCheckedChange={(v) => patch(i, { fijo: v === true })} />
        {te("pinned")}
      </label>
      <div className="ml-auto flex items-center gap-3">
        <ColorControl value={colors[r.clave] ?? null} disabled={busyId === r.columnaId} onPick={(hex) => setColor(r, hex)} clearLabel={t("colClearColor")} />
        <button type="button" onClick={() => setConfigCol(catById.get(r.columnaId) ?? null)} className="text-xs font-medium text-primary hover:underline">
          {t("configure")}
        </button>
        <button type="button" onClick={() => quitar(r)} disabled={busyId === r.columnaId} className="text-xs text-destructive hover:underline">
          {t("colRemove")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* En este tablero: orden (por bloque) + visible/fija + color + configurar + quitar */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("colInBoard")}</h3>
          <p className="text-xs text-muted-foreground">{boardMode ? te("boardMode") : te("personalMode")}</p>
        </div>
        <ul className="space-y-2">
          {blocks.length === 0 && (
            <li className="rounded-md border px-3 py-4 text-sm text-muted-foreground">{t("colNoneInBoard")}</li>
          )}
          {blocks.map((b, bi) => {
            const isChain = !!b.group && b.items.length > 1;
            return (
              <li key={b.group ? `g:${b.group}:${b.items[0].row.columnaId}` : `c:${b.items[0].row.columnaId}`} className="flex items-stretch overflow-hidden rounded-md border">
                <div className="flex flex-col justify-center gap-0.5 border-r bg-muted/30 px-2">
                  <button type="button" onClick={() => moveBlock(bi, -1)} disabled={bi === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={te("moveUp")}>
                    <HugeiconsIcon icon={ArrowUp01Icon} className="size-4" />
                  </button>
                  <button type="button" onClick={() => moveBlock(bi, 1)} disabled={bi === blocks.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={te("moveDown")}>
                    <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  {isChain ? (
                    <div>
                      <div className="flex items-center gap-1.5 border-b bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                        {t("colChain")} · {b.group}
                      </div>
                      <ul className="divide-y">
                        {b.items.map((x) => (
                          <li key={x.row.columnaId}>{memberRow(x.row, x.index)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    memberRow(b.items[0].row, b.items[0].index)
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={saveOrder} disabled={busy}>
            {busy ? tc("saving") : t("colSaveOrder")}
          </Button>
        </div>
      </section>

      {/* Agregar del catálogo + crear nueva */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("colAddFromCatalog")}</h3>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>{t("addColumna")}</Button>
        </div>
        {nonMembers.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("colCatalogEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {nonMembers.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2 opacity-80">
                <span className="text-sm font-medium">{tRoot(c.labelKey)}</span>
                <span className="text-xs text-muted-foreground">· {c.clave} · {c.tipo}</span>
                <Button className="ml-auto" size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => agregar(c)}>
                  {t("colAdd")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {creating && <NuevaColumnaDialog clave={clave} onClose={() => setCreating(false)} onSaved={onChanged} />}
      {configCol && (
        <ColumnConfigDialog col={configCol} transiciones={transiciones} onClose={() => setConfigCol(null)} onSaved={onChanged} />
      )}
    </div>
  );
}

function NuevaColumnaDialog({ clave, onClose, onSaved }: { clave: string; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("configuracion.tableros");
  const tRoot = useTranslations();
  const [v, setV] = React.useState({ clave: "", labelKey: "", tipo: "texto", binding: "", editable: false });
  const [busy, setBusy] = React.useState(false);
  const canSubmit = !!v.clave.trim() && !!v.labelKey.trim() && !!v.binding.trim() && !busy;

  async function submit() {
    setBusy(true);
    try {
      await crearColumna({
        clave: v.clave.trim(),
        labelKey: v.labelKey.trim(),
        tipo: (v.tipo || "texto") as never,
        binding: v.binding.trim(),
        editable: v.editable,
        ambitos: [clave],
      });
      toast.success(t("created"));
      onSaved();
      onClose();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={t("addColumna")} onSubmit={submit} submitting={busy} canSubmit={canSubmit}>
      <Field label={t("clave")}><Input value={v.clave} onChange={(e) => setV((s) => ({ ...s, clave: e.target.value }))} placeholder="prioridad" /></Field>
      <Field label={t("label")}><Input value={v.labelKey} onChange={(e) => setV((s) => ({ ...s, labelKey: e.target.value }))} placeholder="op.col.prioridad" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("colTipo")}><Input value={v.tipo} onChange={(e) => setV((s) => ({ ...s, tipo: e.target.value }))} placeholder="texto" /></Field>
        <Field label={t("colBinding")} hint={t("colBindingHint")}><Input value={v.binding} onChange={(e) => setV((s) => ({ ...s, binding: e.target.value }))} placeholder="op.prioridad" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.editable} onCheckedChange={(x) => setV((s) => ({ ...s, editable: x === true }))} />{t("colEditable")}</label>
    </FormDialog>
  );
}

const COLOR_PRESETS = ["#0D9488", "#0284C7", "#D97706", "#15803D", "#E11D48", "#7C3AED", "#64748B"];

function ColorControl({ value, disabled, onPick, clearLabel }: { value: string | null; disabled?: boolean; onPick: (hex: string | null) => void; clearLabel: string }) {
  return (
    <div className="flex items-center gap-1">
      {COLOR_PRESETS.map((hex) => (
        <button
          key={hex}
          type="button"
          disabled={disabled}
          onClick={() => onPick(hex)}
          title={hex}
          aria-label={hex}
          className={"size-4 rounded-full border transition " + (value === hex ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : "border-border hover:scale-110")}
          style={{ backgroundColor: hex }}
        />
      ))}
      {value && (
        <button type="button" disabled={disabled} onClick={() => onPick(null)} title={clearLabel} aria-label={clearLabel} className="ml-1 text-sm leading-none text-muted-foreground hover:text-foreground">
          ×
        </button>
      )}
    </div>
  );
}
