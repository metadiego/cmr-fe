"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listProveedores,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  type Proveedor,
} from "@/lib/api/inventario";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useConfirm } from "@/components/kit/confirm-host";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { missingFields } from "@/lib/forms/missing";
import { PageContainer, PageHeader } from "@/components/ui/page";

export function ProveedoresAdmin() {
  const t = useTranslations("inventario.prov");
  const tc = useTranslations("common");

  const { state, reload } = useResource<Proveedor[]>(() => listProveedores());
  const rows = state.kind === "ok" ? state.data : [];

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Proveedor | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const confirm = useConfirm();

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(p: Proveedor) {
    setEditing(p);
    setFormOpen(true);
  }

  async function onDeactivate(p: Proveedor) {
    const ok = await confirm({
      title: t("deactivateTitle"),
      description: t("deactivateBody", { name: p.name }),
      confirmLabel: t("deactivate"),
      destructive: true,
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await deleteProveedor(p.id);
      toast.success(t("deleted"));
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("help")}
        actions={
          <Button size="sm" onClick={openNew}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("new")}
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.nombre")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.telefono")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.email")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.activo")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  {tc("loading")}
                </td>
              </tr>
            )}
            {state.kind === "ok" && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">{p.phone ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={p.active ? "secondary" : "outline"}>
                    {p.active ? t("active") : t("inactive")}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      {tc("edit")}
                    </Button>
                    {p.active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={busyId === p.id}
                        onClick={() => onDeactivate(p)}
                      >
                        {t("deactivate")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProveedorForm
        open={formOpen}
        proveedor={editing}
        onOpenChange={setFormOpen}
        onSaved={reload}
      />
    </PageContainer>
  );
}

type FormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
};
const EMPTY: FormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  active: true,
};

function ProveedorForm({
  open,
  proveedor,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  proveedor: Proveedor | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("inventario.prov");
  const isEdit = !!proveedor;

  // Re-initialised when the dialog opens or another supplier is loaded.
  const [form, update] = useDialogForm<FormState>(
    () =>
      proveedor
        ? {
            name: proveedor.name ?? "",
            phone: proveedor.phone ?? "",
            email: proveedor.email ?? "",
            address: proveedor.address ?? "",
            active: proveedor.active ?? true,
          }
        : EMPTY,
    open,
    proveedor?.id,
  );

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    update({ [k]: v } as Partial<FormState>);
  }

  const missing = missingFields([[t("field.nombre"), form.name.trim().length > 0]]);

  const { submitting, submit } = useSubmit(
    async () => {
      const txt = (s: string) => (s.trim() ? s.trim() : undefined);
      const base = {
        name: form.name.trim(),
        phone: txt(form.phone),
        email: txt(form.email),
        address: txt(form.address),
      };
      if (isEdit && proveedor) {
        await updateProveedor(proveedor.id, { ...base, active: form.active });
      } else {
        await createProveedor(base);
      }
    },
    {
      successMessage: isEdit ? t("updated") : t("created"),
      onSuccess: () => {
        onOpenChange(false);
        onSaved();
      },
      onError: (err) => {
        toast.error(apiErrorMessage(err));
        return true;
      },
    },
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={isEdit ? t("editTitle") : t("newTitle")}
      description={t("formDescription")}
      onSubmit={() => submit()}
      submitting={submitting}
      missing={missing}
    >
      <Field label={t("field.nombre")} htmlFor="supplier-name" required>
        <Input id="supplier-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label={t("field.telefono")} htmlFor="supplier-phone">
        <Input
          id="supplier-phone"
          type="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </Field>
      <Field label={t("field.email")} htmlFor="supplier-email">
        <Input
          id="supplier-email"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </Field>
      <Field label={t("field.direccion")} htmlFor="supplier-address">
        <Input
          id="supplier-address"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </Field>
      {isEdit && (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label htmlFor="supplier-active">{t("field.activo")}</Label>
          <Switch
            id="supplier-active"
            checked={form.active}
            onCheckedChange={(v) => set("active", v)}
          />
        </div>
      )}
    </FormDialog>
  );
}
