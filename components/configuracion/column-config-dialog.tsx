"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  actualizarColumna,
  type ColumnaCatalogo,
  type UpdateColumnaInput,
  type Transicion,
} from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Column `tipo` vocabulary (BE Swagger enum) + option sources (BE-documented).
// Listing a fixed contract enum in a control is not business hardcode.
const TIPOS = ["texto", "select", "toggle", "hora", "fecha", "badge", "accion", "derivado"];
const OPTION_SOURCES = ["medicos", "enfermeras", "tipos_cita", "estados"];

interface AccionRow {
  key: string;
  labelKey: string;
  icon?: string;
  kind?: string;
  href?: string;
}

// "Simple de configurar": configura UNA columna con controles amables (no JSON).
// Muestra la config específica según el `tipo`. Persiste con PUT /tablero/columnas/:id.
export function ColumnConfigDialog({
  col,
  transiciones,
  onClose,
  onSaved,
}: {
  col: ColumnaCatalogo;
  transiciones: Transicion[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("configuracion.tableros");
  const tRoot = useTranslations();
  const r = (col.render as Record<string, unknown> | null) ?? {};

  const [tipo, setTipo] = React.useState<string>(col.tipo);
  const [binding, setBinding] = React.useState(col.binding ?? "");
  const [editable, setEditable] = React.useState(!!col.editable);
  const [permiso, setPermiso] = React.useState(col.permiso ?? "");
  const [optionsSource, setOptionsSource] = React.useState((r.optionsSource as string) ?? "");
  const [writeBinding, setWriteBinding] = React.useState((r.writeBinding as string) ?? "");
  const [transition, setTransition] = React.useState((r.transition as string) ?? "");
  const [estampa, setEstampa] = React.useState((r.estampa as string) ?? "");
  const [compute, setCompute] = React.useState((r.compute as string) ?? "");
  const [actions, setActions] = React.useState<AccionRow[]>(
    Array.isArray(r.actions) ? (r.actions as AccionRow[]) : [],
  );
  const [busy, setBusy] = React.useState(false);

  function buildRender(): Record<string, unknown> | null {
    if (tipo === "select") return { optionsSource: optionsSource || null, ...(writeBinding ? { writeBinding } : {}) };
    if (tipo === "toggle") return { transition: transition || null, estampa: estampa || null };
    if (tipo === "derivado") return { compute: compute || null };
    if (tipo === "accion") return { actions };
    return null;
  }

  async function submit() {
    setBusy(true);
    try {
      const payload = {
        tipo,
        binding: binding.trim(),
        editable,
        permiso: permiso.trim() || undefined,
        render: buildRender(),
      } as unknown as UpdateColumnaInput;
      await actualizarColumna(col.id, payload);
      toast.success(t("saved"));
      onSaved();
      onClose();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${t("configure")}: ${tRoot(col.labelKey)}`}
      onSubmit={submit}
      submitting={busy}
      canSubmit={!busy && !!binding.trim()}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("colTipo")}>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("colBinding")} hint={t("colBindingHint")}>
          <Input value={binding} onChange={(e) => setBinding(e.target.value)} placeholder="cita.motivo" />
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={editable} onCheckedChange={(v) => setEditable(v === true)} />
          {t("colEditable")}
        </label>
        <Field label={t("cfgPermiso")} hint={t("cfgPermisoHint")}>
          <Input value={permiso} onChange={(e) => setPermiso(e.target.value)} placeholder="citas.update" />
        </Field>
      </div>

      {/* Config específica por tipo */}
      {tipo === "select" && (
        <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
          <Field label={t("cfgOptionsSource")}>
            <Select value={optionsSource} onValueChange={setOptionsSource}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {OPTION_SOURCES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("cfgWriteBinding")} hint={t("cfgWriteBindingHint")}>
            <Input value={writeBinding} onChange={(e) => setWriteBinding(e.target.value)} placeholder="cita.medicoId" />
          </Field>
        </div>
      )}

      {tipo === "toggle" && (
        <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
          <Field label={t("cfgTransition")}>
            <Select value={transition} onValueChange={setTransition}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {transiciones.map((tr) => <SelectItem key={tr.clave} value={tr.clave}>{tr.clave}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("cfgEstampa")} hint={t("cfgEstampaHint")}>
            <Input value={estampa} onChange={(e) => setEstampa(e.target.value)} placeholder="llegadaEn" />
          </Field>
        </div>
      )}

      {tipo === "derivado" && (
        <div className="rounded-md border bg-muted/30 p-3">
          <Field label={t("cfgCompute")} hint={t("cfgComputeHint")}>
            <Input value={compute} onChange={(e) => setCompute(e.target.value)} placeholder="esperaMin" />
          </Field>
        </div>
      )}

      {tipo === "accion" && (
        <AccionesEditor actions={actions} onChange={setActions} />
      )}
    </FormDialog>
  );
}

function AccionesEditor({ actions, onChange }: { actions: AccionRow[]; onChange: (a: AccionRow[]) => void }) {
  const t = useTranslations("configuracion.tableros");
  function patch(i: number, k: keyof AccionRow, v: string) {
    onChange(actions.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)));
  }
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("cfgActions")}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...actions, { key: "", labelKey: "", kind: "link" }])}>
          {t("cfgAddAction")}
        </Button>
      </div>
      {actions.length === 0 && <p className="text-xs text-muted-foreground">{t("cfgNoActions")}</p>}
      {actions.map((a, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-md border bg-background p-2">
          <Input value={a.key} onChange={(e) => patch(i, "key", e.target.value)} placeholder={t("cfgActionKey")} />
          <Input value={a.labelKey} onChange={(e) => patch(i, "labelKey", e.target.value)} placeholder={t("cfgActionLabel")} />
          <Select value={a.kind ?? "link"} onValueChange={(v) => patch(i, "kind", v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="link">{t("cfgKindLink")}</SelectItem>
              <SelectItem value="soon">{t("cfgKindSoon")}</SelectItem>
            </SelectContent>
          </Select>
          <Input value={a.icon ?? ""} onChange={(e) => patch(i, "icon", e.target.value)} placeholder={t("cfgActionIcon")} />
          {a.kind === "link" && (
            <Input className="col-span-2" value={a.href ?? ""} onChange={(e) => patch(i, "href", e.target.value)} placeholder="/clientes/:pacienteId" />
          )}
          <Button type="button" size="sm" variant="ghost" className="col-span-2 justify-self-end text-destructive" onClick={() => onChange(actions.filter((_, idx) => idx !== i))}>
            {t("cfgRemove")}
          </Button>
        </div>
      ))}
    </div>
  );
}
