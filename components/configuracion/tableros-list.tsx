"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  getTableros,
  crearTablero,
  type TableroRegistro,
} from "@/lib/api/tablero";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { DataTable, type Column } from "@/components/kit/data-table";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { RequiredLegend } from "@/components/kit/required-mark";
import { PageContainer, PageHeader } from "@/components/ui/page";
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
    return (
      <PageContainer>
        <p className="text-center text-sm text-muted-foreground">{t("noAccess")}</p>
      </PageContainer>
    );
  }

  const columns: Column<TableroRegistro>[] = [
    { key: "clave", header: t("clave"), cell: (r) => <span className="font-mono text-xs">{r.slug}</span> },
    { key: "label", header: t("label"), cell: (r) => tRoot(r.labelKey) },
    { key: "layout", header: t("layout"), cell: (r) => r.layout },
    { key: "entidad", header: t("entidad"), cell: (r) => <span className="font-mono text-xs">{r.entity}</span> },
    {
      key: "activo",
      header: t("active"),
      cell: (r) => (
        <Badge variant={r.active ? "secondary" : "outline"}>{r.active ? tc("yes") : tc("no")}</Badge>
      ),
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-4">
          <Link href={r.path ?? `/boards/${r.slug}`} className="text-sm text-primary hover:underline">
            {t("open")}
          </Link>
          <Link href={`/configuration/boards/${r.slug}`} className="text-sm text-primary hover:underline">
            {t("edit")}
          </Link>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("help")}
        actions={<Button onClick={() => setOpen(true)}>{t("new")}</Button>}
      />

      <DataTable
        columns={columns}
        state={state}
        getRowKey={(r) => r.id}
        onReload={reload}
        labels={{ loading: tc("loading"), empty: tc("empty"), retry: tc("retry") }}
      />

      {open && <CrearTableroDialog onClose={() => setOpen(false)} onSaved={reload} />}
    </PageContainer>
  );
}

function CrearTableroDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("configuracion.tableros");
  const [clave, setClave] = React.useState("");
  const [labelKey, setLabelKey] = React.useState("");
  const [layout, setLayout] = React.useState("etapas");
  const [entidad, setEntidad] = React.useState("");
  const [icon, setIcon] = React.useState("");
  const [esVertical, setEsVertical] = React.useState(true);

  const missing = missingFields([
    [t("clave"), !!clave.trim()],
    [t("label"), !!labelKey.trim()],
    [t("layout"), !!layout],
    [t("entidad"), !!entidad.trim()],
  ]);

  const { submitting, submit } = useSubmit(
    () =>
      crearTablero({
        slug: clave.trim(),
        labelKey: labelKey.trim(),
        layout,
        entity: entidad.trim(),
        icon: icon.trim() || undefined,
        isVertical: esVertical,
      }),
    {
      successMessage: t("created"),
      onSuccess: () => {
        onSaved();
        onClose();
      },
    },
  );

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("new")}
      description={t("newHelp")}
      onSubmit={() => submit()}
      submitting={submitting}
      missing={missing}
    >
      <RequiredLegend />
      <Field label={t("clave")} htmlFor="board-key" hint={t("claveHint")} required>
        <Input id="board-key" aria-describedby="board-key-hint" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="operaciones" />
      </Field>
      <Field label={t("label")} htmlFor="board-label" hint={t("labelHint")} required>
        <Input id="board-label" aria-describedby="board-label-hint" value={labelKey} onChange={(e) => setLabelKey(e.target.value)} placeholder="nav.operaciones" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("layout")} htmlFor="board-layout" required>
          <Select value={layout} onValueChange={setLayout}>
            <SelectTrigger id="board-layout" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="etapas">etapas</SelectItem>
              <SelectItem value="tabla">tabla</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("entidad")} htmlFor="board-entity" hint={t("entidadHint")} required>
          <Input id="board-entity" aria-describedby="board-entity-hint" value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="operacion" />
        </Field>
      </div>
      <Field label={t("icon")} htmlFor="board-icon">
        <Input id="board-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="activity" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={esVertical} onCheckedChange={(v) => setEsVertical(v === true)} />
        {t("esVertical")}
      </label>
    </FormDialog>
  );
}
