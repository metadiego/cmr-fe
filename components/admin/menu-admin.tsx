"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getAllMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  type MenuItem,
  type MenuItemPayload,
} from "@/lib/api/menu";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/kit/data-table";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { getPermisos } from "@/lib/api/rbac";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select no admite value=""; centinela para "sin permiso" (visible a todos).
const SIN_PERMISO = "__sin_permiso__";

const EMPTY: MenuItemPayload = {
  clave: "",
  labelKey: "",
  path: "",
  parentClave: "",
  orden: 0,
  permisoClave: "",
  visible: true,
};

// Admin CRUD for the dynamic menu registry (GET/POST/PUT/DELETE /menu).
export function MenuAdmin() {
  const t = useTranslations("admin.menu");
  const { state, reload } = useResource<MenuItem[]>(() => getAllMenu());
  const [editing, setEditing] = React.useState<MenuItem | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function onDelete(item: MenuItem) {
    setBusyId(item.id);
    try {
      await deleteMenuItem(item.id);
      toast.success(t("deleted"));
      reload();
    } catch (err) {
      toastError(err);
    } finally {
      setBusyId(null);
    }
  }

  const columns: Column<MenuItem>[] = [
    { key: "orden", header: t("orden"), cell: (m) => m.orden },
    {
      key: "clave",
      header: t("clave"),
      cell: (m) => (
        <span className="font-mono text-xs">
          {m.parentClave ? `${m.parentClave} › ` : ""}
          {m.clave}
        </span>
      ),
    },
    { key: "path", header: t("path"), cell: (m) => <span className="font-mono text-xs">{m.path}</span> },
    {
      key: "visible",
      header: t("visible"),
      cell: (m) =>
        m.visible ? <Badge variant="secondary">{t("yes")}</Badge> : <Badge variant="outline">{t("no")}</Badge>,
    },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (m) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
            {t("edit")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busyId === m.id}
            onClick={() => onDelete(m)}
          >
            {t("delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("help")}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          {t("create")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        state={state}
        getRowKey={(m) => m.id}
        onReload={reload}
      />

      <MenuItemForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={reload}
      />
      <MenuItemForm
        key={editing?.id ?? "new"}
        item={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={reload}
      />
    </section>
  );
}

function MenuItemForm({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item?: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.menu");
  const [form, setForm] = React.useState<MenuItemPayload>(
    item ? toPayload(item) : EMPTY,
  );
  const [submitting, setSubmitting] = React.useState(false);
  // Catálogo de permisos para el picker (reemplaza el texto libre).
  const { state: permisosState } = useResource(() => getPermisos(), [open]);
  const permisos = permisosState.kind === "ok" ? permisosState.data : [];

  function set<K extends keyof MenuItemPayload>(k: K, v: MenuItemPayload[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleOpenChange(next: boolean) {
    if (!next) setForm(item ? toPayload(item) : EMPTY);
    onOpenChange(next);
  }

  async function onSubmit() {
    if (!form.clave.trim() || !form.labelKey?.trim() || !form.path?.trim()) return;
    setSubmitting(true);
    try {
      const payload: MenuItemPayload = {
        ...form,
        parentClave: form.parentClave?.trim() || null,
        permisoClave: form.permisoClave?.trim() || null,
        orden: Number(form.orden) || 0,
      };
      if (item) await updateMenuItem(item.id, payload);
      else await createMenuItem(payload);
      toast.success(t("saved"));
      handleOpenChange(false);
      onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={item ? t("editTitle") : t("createTitle")}
      description={t("formHelp")}
      submitting={submitting}
      canSubmit={
        !!form.clave.trim() && !!form.labelKey?.trim() && !!form.path?.trim()
      }
      onSubmit={onSubmit}
    >
      <Field label={t("clave")}>
        <Input
          value={form.clave}
          onChange={(e) => set("clave", e.target.value)}
          placeholder="pacientes"
          className="font-mono"
        />
      </Field>
      <Field label={t("labelKey")} hint={t("labelKeyHint")}>
        <Input
          value={form.labelKey}
          onChange={(e) => set("labelKey", e.target.value)}
          placeholder="nav.patients"
          className="font-mono"
        />
      </Field>
      <Field label={t("path")}>
        <Input
          value={form.path}
          onChange={(e) => set("path", e.target.value)}
          placeholder="/patients"
          className="font-mono"
        />
      </Field>
      <Field label={t("parentClave")} hint={t("parentClaveHint")}>
        <Input
          value={form.parentClave ?? ""}
          onChange={(e) => set("parentClave", e.target.value)}
          className="font-mono"
        />
      </Field>
      {/* Picker contra el catálogo real: el texto libre dejaba ítems con
          permisos inexistentes (invisibles para todos). */}
      <Field label={t("permisoClave")} hint={t("permisoClaveHint")}>
        <Select
          value={form.permisoClave || SIN_PERMISO}
          onValueChange={(v) =>
            set("permisoClave", v === SIN_PERMISO ? "" : v)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("permisoClavePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_PERMISO}>{t("permisoSinPermiso")}</SelectItem>
            {permisos.map((p) => (
              <SelectItem key={p.clave} value={p.clave}>
                {p.clave}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("orden")}>
        <Input
          type="number"
          value={String(form.orden ?? 0)}
          onChange={(e) => set("orden", Number(e.target.value))}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.visible ?? true}
          onCheckedChange={(v) => set("visible", v === true)}
        />
        {t("visible")}
      </label>
    </FormDialog>
  );
}

function toPayload(m: MenuItem): MenuItemPayload {
  return {
    clave: m.clave,
    labelKey: m.labelKey,
    path: m.path,
    icon: m.icon ?? null,
    parentClave: m.parentClave ?? "",
    orden: m.orden,
    permisoClave: m.permisoClave ?? "",
    visible: m.visible,
  };
}
