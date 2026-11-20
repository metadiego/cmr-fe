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
import { callIfPermitted } from "@/lib/rbac/call-if-permitted";
import { useResource } from "@/hooks/use-resource";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/kit/data-table";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useSubmit } from "@/components/kit/use-submit";
import { useConfirm } from "@/components/kit/confirm-host";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { missingFields } from "@/lib/forms/missing";
import { getPermisos } from "@/lib/api/rbac";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select does not accept value=""; sentinel for "no permission" (visible to everyone).
const SIN_PERMISO = "__sin_permiso__";

const EMPTY: MenuItemPayload = {
  slug: "",
  labelKey: "",
  path: "",
  parentSlug: "",
  sortOrder: 0,
  permissionSlug: "",
  visible: true,
};

// Admin CRUD for the dynamic menu registry (GET/POST/PUT/DELETE /menu).
export function MenuAdmin() {
  const t = useTranslations("admin.menu");
  const me = useMe();
  const permissions = me.kind === "ok" ? me.me.permissions : [];
  // menu.read: sin él, el BE 403 cada llamada (handoff-ruido-403-auditoria.md). Esta pantalla ya
  // vive detrás del tab de admin, pero el permiso real es menu.read, no el rol — se comprueba aquí.
  const { state, reload } = useResource<MenuItem[]>(
    () => callIfPermitted(permissions, "menu.read", () => getAllMenu(), []),
    [permissions.join(",")],
  );
  const [editing, setEditing] = React.useState<MenuItem | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const confirm = useConfirm();

  // `asking` stops a second click / Enter auto-repeat from queueing a second confirm prompt.
  const asking = React.useRef(false);
  async function onDelete(item: MenuItem) {
    if (asking.current) return;
    asking.current = true;
    const ok = await confirm({
      title: t("deleteTitle"),
      description: t("deleteBody", { name: item.slug }),
      confirmLabel: t("delete"),
      destructive: true,
    }).finally(() => (asking.current = false));
    if (!ok) return;
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
    { key: "orden", header: t("orden"), cell: (m) => m.sortOrder },
    {
      key: "clave",
      header: t("clave"),
      cell: (m) => (
        <span className="font-mono text-xs">
          {m.parentSlug ? `${m.parentSlug} › ` : ""}
          {m.slug}
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
  const [form, update] = useDialogForm<MenuItemPayload>(
    () => (item ? toPayload(item) : EMPTY),
    open,
    item?.id,
  );
  // Permission catalogue for the picker (replaces free text).
  const { state: permisosState } = useResource(() => getPermisos(), [open]);
  const permisos = permisosState.kind === "ok" ? permisosState.data : [];

  const missing = missingFields([
    [t("clave"), !!form.slug.trim()],
    [t("labelKey"), !!form.labelKey?.trim()],
    [t("path"), !!form.path?.trim()],
  ]);

  const { submitting, submit } = useSubmit(
    async () => {
      const payload: MenuItemPayload = {
        ...form,
        parentSlug: form.parentSlug?.trim() || null,
        permissionSlug: form.permissionSlug?.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (item) await updateMenuItem(item.id, payload);
      else await createMenuItem(payload);
    },
    {
      successMessage: t("saved"),
      onSuccess: () => {
        onOpenChange(false);
        onSaved();
      },
    },
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? t("editTitle") : t("createTitle")}
      description={t("formHelp")}
      submitting={submitting}
      missing={missing}
      onSubmit={() => submit()}
    >
      <RequiredLegend />
      <Field label={t("clave")} htmlFor="menu-item-slug" required>
        <Input
          id="menu-item-slug"
          value={form.slug}
          onChange={(e) => update({ slug: e.target.value })}
          placeholder="pacientes"
          className="font-mono"
        />
      </Field>
      <Field label={t("labelKey")} htmlFor="menu-item-label-key" hint={t("labelKeyHint")} required>
        <Input
          id="menu-item-label-key"
          value={form.labelKey}
          onChange={(e) => update({ labelKey: e.target.value })}
          placeholder="nav.patients"
          className="font-mono"
          aria-describedby="menu-item-label-key-hint"
        />
      </Field>
      <Field label={t("path")} htmlFor="menu-item-path" required>
        <Input
          id="menu-item-path"
          value={form.path}
          onChange={(e) => update({ path: e.target.value })}
          placeholder="/patients"
          className="font-mono"
        />
      </Field>
      <Field label={t("parentClave")} htmlFor="menu-item-parent" hint={t("parentClaveHint")}>
        <Input
          id="menu-item-parent"
          value={form.parentSlug ?? ""}
          onChange={(e) => update({ parentSlug: e.target.value })}
          className="font-mono"
          aria-describedby="menu-item-parent-hint"
        />
      </Field>
      {/* Picker over the real catalogue: free text left items with non-existent permissions
          (invisible to everyone). */}
      <Field label={t("permisoClave")} htmlFor="menu-item-permission" hint={t("permisoClaveHint")}>
        <Select
          value={form.permissionSlug || SIN_PERMISO}
          onValueChange={(v) => update({ permissionSlug: v === SIN_PERMISO ? "" : v })}
        >
          <SelectTrigger id="menu-item-permission" className="w-full">
            <SelectValue placeholder={t("permisoClavePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_PERMISO}>{t("permisoSinPermiso")}</SelectItem>
            {permisos.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.slug}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("orden")} htmlFor="menu-item-order">
        <Input
          id="menu-item-order"
          type="number"
          value={String(form.sortOrder ?? 0)}
          onChange={(e) => update({ sortOrder: Number(e.target.value) })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.visible ?? true}
          onCheckedChange={(v) => update({ visible: v === true })}
        />
        {t("visible")}
      </label>
    </FormDialog>
  );
}

function toPayload(m: MenuItem): MenuItemPayload {
  return {
    slug: m.slug,
    labelKey: m.labelKey,
    path: m.path,
    icon: m.icon ?? null,
    parentSlug: m.parentSlug ?? "",
    sortOrder: m.sortOrder,
    permissionSlug: m.permissionSlug ?? "",
    visible: m.visible,
  };
}
