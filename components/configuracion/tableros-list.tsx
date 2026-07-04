"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getTableros,
  crearTablero,
  actualizarTablero,
  type TableroRegistro,
} from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { DataTable, type Column } from "@/components/kit/data-table";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Constructor de Tableros — list of verticals + create. Gate `tablero.admin`.
export function TablerosList() {
  const t = useTranslations("configuracion.tableros");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can, ready } = useCan();

  const { state, reload } = useResource<TableroRegistro[]>(() => getTableros());
  const [open, setOpen] = React.useState(false);

  if (ready && !can("tablero.admin")) {
    return <p className="mx-auto max-w-5xl px-6 py-16 text-center text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const columns: Column<TableroRegistro>[] = [
    { key: "clave", header: t("clave"), cell: (r) => <span className="font-mono text-xs">{r.clave}</span> },
    { key: "label", header: t("label"), cell: (r) => tRoot(r.labelKey) },
    { key: "layout", header: t("layout"), cell: (r) => r.layout },
    { key: "entidad", header: t("entidad"), cell: (r) => <span className="font-mono text-xs">{r.entidad}</span> },
    {
      key: "activo",
      header: t("active"),
      cell: (r) => (
        <Badge variant={r.activo ? "secondary" : "outline"}>{r.activo ? tc("yes") : tc("no")}</Badge>
      ),
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-4">
          <Link href={r.ruta ?? `/tablero/${r.clave}`} className="text-sm text-primary hover:underline">
            {t("open")}
          </Link>
          <Link href={`/configuracion/tableros/${r.clave}`} className="text-sm text-primary hover:underline">
            {t("edit")}
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <div className="ml-auto">
          <Button onClick={() => setOpen(true)}>{t("new")}</Button>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("help")}</p>

      <DataTable
        columns={columns}
        state={state}
        getRowKey={(r) => r.id}
        onReload={reload}
        labels={{ loading: tc("loading"), empty: tc("empty"), retry: tc("retry") }}
      />

      {open && <CrearTableroDialog onClose={() => setOpen(false)} onSaved={reload} />}
    </div>
  );
}

function CrearTableroDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("configuracion.tableros");
  const tRoot = useTranslations();
  const [clave, setClave] = React.useState("");
  const [labelKey, setLabelKey] = React.useState("");
  const [layout, setLayout] = React.useState("etapas");
  const [entidad, setEntidad] = React.useState("");
  const [icon, setIcon] = React.useState("");
  const [esVertical, setEsVertical] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const canSubmit = !!clave.trim() && !!labelKey.trim() && !!layout && !!entidad.trim() && !busy;

  async function submit() {
    setBusy(true);
    try {
      await crearTablero({
        clave: clave.trim(),
        labelKey: labelKey.trim(),
        layout,
        entidad: entidad.trim(),
        icon: icon.trim() || undefined,
        esVertical,
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
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("new")}
      description={t("newHelp")}
      onSubmit={submit}
      submitting={busy}
      canSubmit={canSubmit}
    >
      <Field label={t("clave")} hint={t("claveHint")}>
        <Input value={clave} onChange={(e) => setClave(e.target.value)} placeholder="operaciones" />
      </Field>
      <Field label={t("label")} hint={t("labelHint")}>
        <Input value={labelKey} onChange={(e) => setLabelKey(e.target.value)} placeholder="nav.operaciones" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("layout")}>
          <Select value={layout} onValueChange={setLayout}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="etapas">etapas</SelectItem>
              <SelectItem value="tabla">tabla</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("entidad")} hint={t("entidadHint")}>
          <Input value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="operacion" />
        </Field>
      </div>
      <Field label={t("icon")}>
        <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="activity" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={esVertical} onCheckedChange={(v) => setEsVertical(v === true)} />
        {t("esVertical")}
      </label>
    </FormDialog>
  );
}
