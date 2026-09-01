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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// Catálogo de permisos: tabla con buscador por módulo + alta/edición/borrado. La clave `modulo.accion`
// se enseña partida en vivo al escribirla (para que la convención se entienda sin explicarla). La clave
// NO se edita (está en el código y en cada concesión). Handoff permisos-y-roles-pantalla.
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

  const filtrados = permisos
    .filter((p) => {
      const n = q.trim().toLowerCase();
      return !n || p.clave.toLowerCase().includes(n) || (p.descripcion ?? "").toLowerCase().includes(n) || p.modulo.toLowerCase().includes(n);
    })
    .sort((a, b) => a.clave.localeCompare(b.clave));

  async function borrar(p: Permiso) {
    if (!window.confirm(t("borrarConfirm", { clave: p.clave }))) return;
    setBusyId(p.id);
    try {
      await eliminarPermiso(p.id);
      toast.success(t("borrado"));
      res.reload();
    } catch (e) {
      // El BE dice a cuántos afecta y qué hacer → mostrarlo tal cual.
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
                  <td className="px-3 py-2 font-mono">{p.clave}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.modulo}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.accion}</td>
                  <td className="px-3 py-2">{p.descripcion || "—"}</td>
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

      {nuevo && <PermisoNuevoDialog onClose={() => setNuevo(false)} onSaved={() => { setNuevo(false); res.reload(); }} tRoot={tRoot} tc={tc} t={t} />}
      {editar && <PermisoEditarDialog permiso={editar} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); res.reload(); }} tRoot={tRoot} tc={tc} t={t} />}
    </div>
  );
}

function PermisoNuevoDialog({ onClose, onSaved, tRoot, tc, t }: {
  onClose: () => void; onSaved: () => void;
  tRoot: ReturnType<typeof useTranslations>; tc: ReturnType<typeof useTranslations>; t: ReturnType<typeof useTranslations>;
}) {
  const [clave, setClave] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { modulo, accion } = partes(clave);
  const valido = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(clave.trim().toLowerCase().replace(/\s+/g, ""));

  async function guardar() {
    if (!valido || busy) return;
    setBusy(true);
    try {
      await crearPermiso({ clave: clave.trim(), ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}) });
      toast.success(t("creado"));
      onSaved();
    } catch (e) {
      toastError(e, tRoot); // 409 ya existe / 400 formato → mensaje del BE
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("nuevoTitulo")}</DialogTitle>
          <DialogDescription>{t("nuevoDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("field.clave")}</span>
            <Input value={clave} onChange={(e) => setClave(e.target.value)} placeholder="factura.pago.anular" autoFocus />
          </label>
          {/* Preview EN VIVO de cómo se parte la clave — enseña la convención sin explicarla. */}
          {clave.trim() && (
            <div className={valido ? "rounded-md border bg-muted/40 px-3 py-2 text-xs" : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"}>
              {valido ? (
                <span><span className="font-medium">{t("field.modulo")}:</span> <code className="font-mono">{modulo}</code> · <span className="font-medium">{t("field.accion")}:</span> <code className="font-mono">{accion}</code></span>
              ) : t("formatoInvalido")}
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("field.descripcion")}</span>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
            <Button size="sm" onClick={guardar} disabled={!valido || busy}>{busy ? tc("loading") : tc("save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PermisoEditarDialog({ permiso, onClose, onSaved, tRoot, tc, t }: {
  permiso: Permiso; onClose: () => void; onSaved: () => void;
  tRoot: ReturnType<typeof useTranslations>; tc: ReturnType<typeof useTranslations>; t: ReturnType<typeof useTranslations>;
}) {
  const [descripcion, setDescripcion] = React.useState(permiso.descripcion ?? "");
  const [busy, setBusy] = React.useState(false);
  async function guardar() {
    if (busy) return;
    setBusy(true);
    try {
      await actualizarPermiso(permiso.id, descripcion.trim());
      toast.success(t("guardado"));
      onSaved();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editarTitulo")}</DialogTitle>
          <DialogDescription>{t("editarDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("field.clave")}</span>
            {/* La clave es SOLO LECTURA: renombrarla dejaría colgando el código y las concesiones. */}
            <Input value={permiso.clave} disabled readOnly className="font-mono" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("field.descripcion")}</span>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} autoFocus />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
            <Button size="sm" onClick={guardar} disabled={busy}>{busy ? tc("loading") : tc("save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
