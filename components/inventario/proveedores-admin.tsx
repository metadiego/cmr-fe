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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageContainer, PageHeader } from "@/components/ui/page";

export function ProveedoresAdmin() {
  const t = useTranslations("inventario.prov");
  const tc = useTranslations("common");

  const { state, reload } = useResource<Proveedor[]>(() => listProveedores());
  const rows = state.kind === "ok" ? state.data : [];

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Proveedor | null>(null);
  const [deleting, setDeleting] = React.useState<Proveedor | null>(null);
  const [busy, setBusy] = React.useState(false);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(p: Proveedor) {
    setEditing(p);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteProveedor(deleting.id);
      toast.success(t("deleted"));
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
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
                        onClick={() => setDeleting(p)}
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

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deactivateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deactivateBody", { name: deleting?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy}>
              {t("deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const tc = useTranslations("common");
  const isEdit = !!proveedor;

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);

  const [prevId, setPrevId] = React.useState<string | undefined>(undefined);
  const targetId = proveedor?.id;
  if (open && targetId !== prevId) {
    setPrevId(targetId);
    setForm(
      proveedor
        ? {
            name: proveedor.name ?? "",
            phone: proveedor.phone ?? "",
            email: proveedor.email ?? "",
            address: proveedor.address ?? "",
            active: proveedor.active ?? true,
          }
        : EMPTY,
    );
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function onSubmit() {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
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
      toast.success(isEdit ? t("updated") : t("created"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("newTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FormRow label={t("field.nombre")}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </FormRow>
          <FormRow label={t("field.telefono")}>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </FormRow>
          <FormRow label={t("field.email")}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </FormRow>
          <FormRow label={t("field.direccion")}>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </FormRow>
          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label>{t("field.activo")}</Label>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !form.name.trim()}>
            {submitting ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
