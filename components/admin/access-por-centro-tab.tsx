"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { Perfil } from "@/lib/api/profiles";
import { getAsignaciones, updateAsignacion, assignCenter, type Asignacion } from "@/lib/api/profiles";
import {
  getRoles, getProfileAccess, assignRoleToProfile, removeRoleFromProfile,
  type Rol, type ProfileAccess, type AccessRole,
} from "@/lib/api/rbac";
import { getCenters, type Centro } from "@/lib/api/centers";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// «Accesos por centro»: un usuario con un rol distinto en cada centro (perfiles_roles = perfil+rol+centro).
// Tabla por centro: interruptor Activo (le da/quita el centro sin borrar nada) + roles ACOTADOS a ese
// centro. Sección aparte para los roles GLOBALES (todosLosCentros, sin centro; no se acotan). El BE es la
// autoridad; el FE solo llama a los endpoints ya verificados. Handoff roles-por-centro-en-la-ui.
export function AccessPorCentroTab({ profile }: { profile: Perfil }) {
  const t = useTranslations("admin.access");
  const tRoot = useTranslations();
  const [nonce, setNonce] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const reload = () => setNonce((n) => n + 1);

  const centrosRes = useResource<Centro[]>(() => getCenters());
  const rolesRes = useResource<Rol[]>(() => getRoles());
  const asigRes = useResource<Asignacion[]>(() => getAsignaciones(profile.id), [profile.id, nonce]);
  // Acceso GLOBAL (sin centro) + por cada centro asignado, en un solo recurso compuesto.
  const accesosRes = useResource<{ global: ProfileAccess; porCentro: Record<string, ProfileAccess> }>(
    async () => {
      const asigs = await getAsignaciones(profile.id);
      const global = await getProfileAccess(profile.id);
      const entradas = await Promise.all(
        asigs.map((a) => getProfileAccess(profile.id, a.centroId).then((acc) => [a.centroId, acc] as const)),
      );
      return { global, porCentro: Object.fromEntries(entradas) };
    },
    [profile.id, nonce],
  );

  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const roles = rolesRes.state.kind === "ok" ? rolesRes.state.data : [];
  const asigs = asigRes.state.kind === "ok" ? asigRes.state.data : [];
  const nombreCentro = (id: string) => centros.find((c) => c.id === id)?.nombre ?? id;
  const rolesAcotables = roles.filter((r) => !r.todosLosCentros);
  const rolesGlobales = roles.filter((r) => r.todosLosCentros);

  const cargando = asigRes.state.kind === "loading" || accesosRes.state.kind === "loading";
  const acc = accesosRes.state.kind === "ok" ? accesosRes.state.data : null;

  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast.success(t("saved")); reload(); }
    catch (e) { toastError(e, tRoot); }
    finally { setBusy(false); }
  }

  // Roles ACOTADOS a un centro = los del access de ese centro con centroId === ese centro.
  const rolesDeCentro = (centroId: string): AccessRole[] =>
    (acc?.porCentro[centroId]?.roles ?? []).filter((r) => r.centroId === centroId);
  // Roles GLOBALES del perfil = access global con centroId null.
  const rolesGlobalesPerfil: AccessRole[] = (acc?.global.roles ?? []).filter((r) => !r.centroId);

  const centrosSinAsignar = centros.filter((c) => !asigs.some((a) => a.centroId === c.id));

  if (cargando) return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (asigRes.state.kind === "fail") return <p className="text-sm text-destructive">{asigRes.state.message}</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("porCentroAyuda")}</p>

      <div className="overflow-x-auto rounded-md bg-card shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">{t("colCentro")}</th>
              <th className="px-3 py-2 font-semibold">{t("colActivo")}</th>
              <th className="px-3 py-2 font-semibold">{t("colRoles")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {asigs.map((a) => {
              const rolesAqui = rolesDeCentro(a.centroId);
              const disponibles = rolesAcotables.filter((r) => !rolesAqui.some((x) => x.clave === r.clave));
              return (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-medium">{nombreCentro(a.centroId)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => updateAsignacion(profile.id, a.id, { activo: !(a.activo ?? true) }))}
                      className={"inline-flex h-6 w-11 items-center rounded-full px-0.5 transition-colors " + ((a.activo ?? true) ? "bg-primary" : "bg-muted-foreground/30")}
                      aria-pressed={a.activo ?? true}
                      aria-label={t("colActivo")}
                    >
                      <span className={"size-5 rounded-full bg-white transition-transform " + ((a.activo ?? true) ? "translate-x-5" : "")} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {rolesAqui.map((r) => (
                        <span key={r.rolId} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {r.nombre || r.clave}
                          <button type="button" disabled={busy} onClick={() => run(() => removeRoleFromProfile(profile.id, r.rolId, a.centroId))} className="text-primary/70 hover:text-primary" aria-label={tRoot("common.delete")}>✕</button>
                        </span>
                      ))}
                      {rolesAqui.length === 0 && <span className="text-xs italic text-muted-foreground">{t("sinRolCentro")}</span>}
                      {disponibles.length > 0 && (
                        <Select value="" onValueChange={(clave) => run(() => assignRoleToProfile(profile.id, clave, a.centroId))}>
                          <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder={t("anadirRol")} /></SelectTrigger>
                          <SelectContent>
                            {disponibles.map((r) => <SelectItem key={r.id} value={r.clave}>{r.nombre}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {asigs.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">{t("sinCentros")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Añadir centro */}
      {centrosSinAsignar.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("anadirCentro")}</span>
          <Select value="" onValueChange={(centroId) => run(() => assignCenter(profile.id, { centroId, tipo: "base" }))}>
            <SelectTrigger className="h-8 w-52 text-sm"><SelectValue placeholder={t("elegirCentro")} /></SelectTrigger>
            <SelectContent>
              {centrosSinAsignar.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Roles GLOBALES (todos los centros): sin centro, no se acotan */}
      <div className="rounded-md bg-card p-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("rolesGlobales")}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {rolesGlobalesPerfil.map((r) => (
            <span key={r.rolId} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium">
              {r.nombre || r.clave}
              <button type="button" disabled={busy} onClick={() => run(() => removeRoleFromProfile(profile.id, r.rolId))} className="text-muted-foreground hover:text-foreground" aria-label={tRoot("common.delete")}>✕</button>
            </span>
          ))}
          {rolesGlobalesPerfil.length === 0 && <span className="text-xs italic text-muted-foreground">{t("sinRolesGlobales")}</span>}
          {(() => {
            const disp = rolesGlobales.filter((r) => !rolesGlobalesPerfil.some((x) => x.clave === r.clave));
            return disp.length > 0 ? (
              <Select value="" onValueChange={(clave) => run(() => assignRoleToProfile(profile.id, clave))}>
                <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder={t("anadir")} /></SelectTrigger>
                <SelectContent>{disp.map((r) => <SelectItem key={r.id} value={r.clave}>{r.nombre}</SelectItem>)}</SelectContent>
              </Select>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}
