"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getColumnasCatalogo,
  crearColumna,
  actualizarColumna,
  type ColumnaCatalogo,
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
              <span className="ml-auto truncate font-mono text-xs text-muted-foreground">{c.binding}</span>
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
