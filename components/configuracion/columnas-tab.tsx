"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getColumnasCatalogo,
  getDefinicion,
  crearColumna,
  actualizarColumna,
  colorColumna,
  type ColumnaCatalogo,
  type TableroDefinicion,
} from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

// Columnas de un vertical: REUSAR el catálogo existente (toggle `ambitos`) en vez
// de duplicar. Lista todo el catálogo con un check "en este tablero"; crear nueva
// solo para las genuinamente nuevas. Evita columnas fd_-style repetidas.
export function ColumnasTab({ clave }: { clave: string }) {
  const t = useTranslations("configuracion.tableros");
  const tRoot = useTranslations();
  const { state, reload } = useResource<ColumnaCatalogo[]>(() => getColumnasCatalogo());
  const cols = (state.kind === "ok" ? state.data : []).filter((c) => c.activo);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  // Colores actuales del tablero (pre-personalización admin). Vienen de la
  // definición (por columna efectiva); se escriben con colorColumna (composición).
  const defRes = useResource<TableroDefinicion>(() => getDefinicion(clave), [clave]);
  const colorByClave: Record<string, string | null> = {};
  if (defRes.state.kind === "ok") {
    for (const c of defRes.state.data.columnas) colorByClave[c.clave] = c.color ?? null;
  }

  async function setColor(c: ColumnaCatalogo, color: string | null) {
    setBusyId(c.id);
    try {
      await colorColumna(clave, c.id, color);
      defRes.reload();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(c: ColumnaCatalogo) {
    const has = (c.ambitos ?? []).includes(clave);
    const ambitos = has
      ? (c.ambitos ?? []).filter((a) => a !== clave)
      : [...(c.ambitos ?? []), clave];
    setBusyId(c.id);
    try {
      await actualizarColumna(c.id, { ambitos });
      reload();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...cols].sort((a, b) => {
    const am = (a.ambitos ?? []).includes(clave) ? 0 : 1;
    const bm = (b.ambitos ?? []).includes(clave) ? 0 : 1;
    return am - bm || a.clave.localeCompare(b.clave);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("colIncorporarHelp")}</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("addColumna")}</Button>
      </div>

      <ul className="divide-y rounded-md border">
        {sorted.map((c) => {
          const has = (c.ambitos ?? []).includes(clave);
          return (
            <li key={c.id} className={"flex items-center gap-3 px-3 py-2 " + (has ? "" : "opacity-60")}>
              <Checkbox checked={has} disabled={busyId === c.id} onCheckedChange={() => toggle(c)} />
              <span className="text-sm font-medium">{tRoot(c.labelKey)}</span>
              <span className="text-xs text-muted-foreground">· {c.clave} · {c.tipo}</span>
              <div className="ml-auto flex items-center gap-3">
                {has && (
                  <ColorControl
                    value={colorByClave[c.clave] ?? null}
                    disabled={busyId === c.id}
                    onPick={(hex) => setColor(c, hex)}
                    clearLabel={t("colClearColor")}
                  />
                )}
                <span className="truncate font-mono text-xs text-muted-foreground">{c.binding}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-muted-foreground">
        {t("composeHint")}{" "}
        <Link href={`/citas/config/columnas?tablero=${clave}`} className="text-primary hover:underline">{t("composeLink")}</Link>
      </p>

      {open && <NuevaColumnaDialog clave={clave} onClose={() => setOpen(false)} onSaved={reload} />}
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

// Admin pre-personalization: a colour per column in THIS board. Presets + clear.
// Writes via colorColumna (/tablero/composicion); the user can still override it
// in their own view later.
const COLOR_PRESETS = ["#0D9488", "#0284C7", "#D97706", "#15803D", "#E11D48", "#7C3AED", "#64748B"];

function ColorControl({
  value,
  disabled,
  onPick,
  clearLabel,
}: {
  value: string | null;
  disabled?: boolean;
  onPick: (hex: string | null) => void;
  clearLabel: string;
}) {
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
          className={
            "size-4 rounded-full border transition " +
            (value === hex
              ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
              : "border-border hover:scale-110")
          }
          style={{ backgroundColor: hex }}
        />
      ))}
      {value && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPick(null)}
          title={clearLabel}
          aria-label={clearLabel}
          className="ml-1 text-sm leading-none text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      )}
    </div>
  );
}
