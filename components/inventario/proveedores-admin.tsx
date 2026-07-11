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
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button size="sm" onClick={openNew}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("new")}
        </Button>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      <div className="overflow-x-auto rounded-xl border">
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
                <td className="px-3 py-2 font-medium">{p.nombre}</td>
                <td className="px-3 py-2">{p.telefono ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={p.activo ? "secondary" : "outline"}>
                    {p.activo ? t("active") : t("inactive")}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      {tc("edit")}
                    </Button>
                    {p.activo && (
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
              {t("deactivateBody", { name: deleting?.nombre ?? "" })}
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
    </div>
  );
}

type FormState = {
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  activo: boolean;
};
const EMPTY: FormState = {
  nombre: "",
  telefono: "",
  email: "",
  direccion: "",
  activo: true,
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
            nombre: proveedor.nombre ?? "",
            telefono: proveedor.telefono ?? "",
            email: proveedor.email ?? "",
            direccion: proveedor.direccion ?? "",
            activo: proveedor.activo ?? true,
          }
        : EMPTY,
    );
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function onSubmit() {
    if (!form.nombre.trim()) return;
    setSubmitting(true);
    try {
      const txt = (s: string) => (s.trim() ? s.trim() : undefined);
      const base = {
        nombre: form.nombre.trim(),
        telefono: txt(form.telefono),
        email: txt(form.email),
        direccion: txt(form.direccion),
      };
      if (isEdit && proveedor) {
        await updateProveedor(proveedor.id, { ...base, activo: form.activo });
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
            <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </FormRow>
          <FormRow label={t("field.telefono")}>
            <Input
              type="tel"
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
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
              value={form.direccion}
              onChange={(e) => set("direccion", e.target.value)}
            />
          </FormRow>
          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label>{t("field.activo")}</Label>
              <Switch checked={form.activo} onCheckedChange={(v) => set("activo", v)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !form.nombre.trim()}>
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
