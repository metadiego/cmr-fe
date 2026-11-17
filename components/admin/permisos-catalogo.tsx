"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getPermisos,
  crearPermiso,
  actualizarPermiso,
  eliminarPermiso,
  type Permiso,
} from "@/lib/api/rbac";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { missingFields } from "@/lib/forms/missing";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useConfirm } from "@/components/kit/confirm-host";
import { useSubmit } from "@/components/kit/use-submit";

// Permission catalogue: table with a module search + create/edit/delete. The `module.action` key is
// shown split live while typing (so the convention is learnt without explaining it). The key is NOT
// editable (it lives in the code and in every grant). Handoff permisos-y-roles-pantalla.
function partes(clave: string): { modulo: string; accion: string } {
  const c = clave.trim().toLowerCase().replace(/\s+/g, "");
  const i = c.indexOf(".");
  return i < 0 ? { modulo: c, accion: "" } : { modulo: c.slice(0, i), accion: c.slice(i + 1) };
}

export function PermisosCatalogo() {
  const t = useTranslations("admin.permisos");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  const res = useResource<Permiso[]>(() => getPermisos());
  const permisos = res.state.kind === "ok" ? res.state.data : [];
  const [q, setQ] = React.useState("");
  const [nuevo, setNuevo] = React.useState(false);
  const [editar, setEditar] = React.useState<Permiso | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const confirm = useConfirm();

  const filtrados = permisos
    .filter((p) => {
      const n = q.trim().toLowerCase();
      return !n || p.slug.toLowerCase().includes(n) || (p.description ?? "").toLowerCase().includes(n) || p.module.toLowerCase().includes(n);
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  async function borrar(p: Permiso) {
    const ok = await confirm({ title: t("borrarConfirm", { clave: p.slug }), confirmLabel: tc("delete"), destructive: true });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await eliminarPermiso(p.id);
      toast.success(t("borrado"));
      res.reload();
    } catch (e) {
      // The BE says how many it affects and what to do → show it as is.
      toastError(e, tRoot);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("buscar")} className="max-w-xs" />
        <span className="text-xs text-muted-foreground">{t("total", { n: filtrados.length })}</span>
        {can("rbac.create") && <Button size="sm" className="ml-auto" onClick={() => setNuevo(true)}>{t("nuevo")}</Button>}
      </div>

      {res.state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
      {res.state.kind === "fail" && <p className="text-sm text-destructive">{res.state.message}</p>}

      {res.state.kind === "ok" && (
        <div className="overflow-x-auto rounded-md bg-card shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b text-left">
                <th className="px-3 py-2 font-semibold">{t("col.clave")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.modulo")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.accion")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.descripcion")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtrados.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{t("vacio")}</td></tr>
              )}
              {filtrados.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono">{p.slug}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.module}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.action}</td>
                  <td className="px-3 py-2">{p.description || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {can("rbac.update") && <Button variant="ghost" size="sm" onClick={() => setEditar(p)}>{tc("edit")}</Button>}
                      {can("rbac.delete") && <Button variant="ghost" size="sm" className="text-destructive" disabled={busyId === p.id} onClick={() => borrar(p)}>{tc("delete")}</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nuevo && <PermisoNuevoDialog onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); res.reload(); }} tc={tc} t={t} />}
      {editar && <PermisoEditarDialog permiso={editar} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); res.reload(); }} tc={tc} t={t} />}
    </div>
  );
}

function PermisoNuevoDialog({ onClose, onSaved, tc, t }: {
  onClose: () => void; onSaved: () => void;
  tc: ReturnType<typeof useTranslations>; t: ReturnType<typeof useTranslations>;
}) {
  // Mounted only while open (the parent renders it conditionally), so plain state resets itself.
  const [clave, setClave] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const { modulo, accion } = partes(clave);
  const valido = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(clave.trim().toLowerCase().replace(/\s+/g, ""));
  const missing = missingFields([[t("field.clave"), !!clave.trim()]]);
  // Filled but malformed: explained in the footer, not counted as missing.
  const invalid = !!clave.trim() && !valido;

  const { submitting, submit } = useSubmit(
    // 409 already exists / 400 format → the BE message (via the default error toast).
    () => crearPermiso({ slug: clave.trim(), ...(descripcion.trim() ? { description: descripcion.trim() } : {}) }),
    { successMessage: t("creado"), onSuccess: () => onSaved() },
  );

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("nuevoTitulo")}
      description={t("nuevoDesc")}
      onSubmit={() => submit()}
      submitting={submitting}
      submittingLabel={tc("loading")}
      submitLabel={tc("save")}
      cancelLabel={tc("cancel")}
      missing={missing}
      blocked={invalid}
      reason={invalid ? t("formatoInvalido") : null}
    >
      <Field label={t("field.clave")} htmlFor="permission-new-key" required>
        <Input id="permission-new-key" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="factura.pago.anular" autoFocus />
      </Field>
      {/* LIVE preview of how the key splits — teaches the convention without explaining it. */}
      {clave.trim() && valido && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span><span className="font-medium">{t("field.modulo")}:</span> <code className="font-mono">{modulo}</code> · <span className="font-medium">{t("field.accion")}:</span> <code className="font-mono">{accion}</code></span>
        </div>
      )}
      <Field label={t("field.descripcion")} htmlFor="permission-new-description">
        <Input id="permission-new-description" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Field>
    </FormDialog>
  );
}

function PermisoEditarDialog({ permiso, onClose, onSaved, tc, t }: {
  permiso: Permiso; onClose: () => void; onSaved: () => void;
  tc: ReturnType<typeof useTranslations>; t: ReturnType<typeof useTranslations>;
}) {
  // Mounted only while open, per permission (the parent renders it conditionally).
  const [descripcion, setDescripcion] = React.useState(permiso.description ?? "");
  const { submitting, submit } = useSubmit(
    () => actualizarPermiso(permiso.id, descripcion.trim()),
    { successMessage: t("guardado"), onSuccess: () => onSaved() },
  );
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("editarTitulo")}
      description={t("editarDesc")}
      onSubmit={() => submit()}
      submitting={submitting}
      submittingLabel={tc("loading")}
      submitLabel={tc("save")}
      cancelLabel={tc("cancel")}
    >
      <Field label={t("field.clave")} htmlFor="permission-edit-key">
        {/* The key is READ-ONLY: renaming it would leave the code and the grants dangling. */}
        <Input id="permission-edit-key" value={permiso.slug} disabled readOnly className="font-mono" />
      </Field>
      <Field label={t("field.descripcion")} htmlFor="permission-edit-description">
        <Input id="permission-edit-description" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} autoFocus />
      </Field>
    </FormDialog>
  );
}
