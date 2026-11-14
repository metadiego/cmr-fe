"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  inviteUser,
  assignCenter,
  getProfiles,
  type InviteResponse,
  type Perfil,
} from "@/lib/api/profiles";
import { getCenters } from "@/lib/api/centers";
import { getRoles, clonarAccesoDe, assignRoleToProfile } from "@/lib/api/rbac";
import { listPersonal, type Personal } from "@/lib/api/personal";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useMe, isAdmin } from "@/hooks/use-me";
import { isAdminRole } from "@/lib/access/role-keys";
import { ALL_CENTERS, planInvite, suggestStaff } from "@/lib/admin/invite";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmailInput } from "@/components/email-input";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export function InviteDialog({
  open,
  onOpenChange,
  onInvited,
  onRequestAssign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: () => void;
  onRequestAssign?: (profile: Perfil) => void;
}) {
  const t = useTranslations("admin.invite");
  const tc = useTranslations("admin");
  const tRoot = useTranslations();

  const [email, setEmail] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [apellido, setApellido] = React.useState("");
  // Enlace opcional a una PERSONA ya dada de alta (personal sin cuenta): al invitarla, la cuenta nueva
  // se engancha a su ficha y conserva su historial. "" = cuenta sin ficha, como antes.
  const [personalId, setPersonalId] = React.useState("");
  // Invite ampliado: centro + rol en el mismo paso (si no, el invitado nace sin
  // accesos y su primer login es un 403).
  const [centroId, setCentroId] = React.useState("");
  const [rolClave, setRolClave] = React.useState("");
  const [temporal, setTemporal] = React.useState(false);
  const [vigenteHasta, setVigenteHasta] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<InviteResponse | null>(null);
  const [copied, setCopied] = React.useState(false);
  // "Clone from": copy another profile's access to the new one (after inviting). Since cmr-be #557
  // only an admin manages access, so the field is shown to admins only.
  const meState = useMe();
  const puedeClonar = meState.kind === "ok" && isAdmin(meState.me);
  const [origenPerfilId, setOrigenPerfilId] = React.useState("");
  const [origenQuery, setOrigenQuery] = React.useState("");
  const [origenOpen, setOrigenOpen] = React.useState(false);
  const [cloneMsg, setCloneMsg] = React.useState<string | null>(null);
  const { state: perfilesState } = useResource(
    () => (open && puedeClonar ? getProfiles(1, 200) : Promise.resolve([] as Perfil[])),
    [open, puedeClonar],
  );
  const perfiles = perfilesState.kind === "ok" ? perfilesState.data : [];
  const nombreDe = (p: Perfil) => [p.name, p.lastName].filter(Boolean).join(" ").trim() || p.email || p.id;
  const origenSel = perfiles.find((p) => p.id === origenPerfilId) ?? null;
  const origenMatches = origenQuery.trim()
    ? perfiles.filter((p) => `${nombreDe(p)} ${p.email ?? ""}`.toLowerCase().includes(origenQuery.trim().toLowerCase())).slice(0, 8)
    : perfiles.slice(0, 8);

  const { state: centrosState } = useResource(
    () => (open ? getCenters() : Promise.resolve([])),
    [open],
  );
  const centros = centrosState.kind === "ok" ? centrosState.data : [];
  const { state: rolesState } = useResource(
    () => (open ? getRoles() : Promise.resolve([])),
    [open],
  );
  // The admin role is granted globally and with an explicit confirmation, which the invite cannot
  // ask for (cmr-be would create the user without it). It is given afterwards from the user's roles.
  const roles = (rolesState.kind === "ok" ? rolesState.data : []).filter((r) => !isAdminRole(r));
  // Personas dadas de alta SIN cuenta (perfilId === null): candidatas a enganchar. 65 activas en Caguas
  // → entran en una página; si algún día no cupieran, el BE ofrecerá `?sinCuenta=true`.
  const { state: personalState } = useResource(
    () => (open ? listPersonal({ limit: 100 }).then((r) => r.items) : Promise.resolve([] as Personal[])),
    [open],
  );
  const sinCuenta = (personalState.kind === "ok" ? personalState.data : [])
    .filter((p) => p.profileId == null && p.active !== false)
    .sort((a, b) => `${a.name} ${a.lastName ?? ""}`.localeCompare(`${b.name} ${b.lastName ?? ""}`));

  // A staff record without a login whose name matches what was typed: offered so the admin links it
  // instead of creating the same person twice.
  const suggested = personalId ? null : suggestStaff(sinCuenta, nombre, apellido);
  const centerName = (id?: string | null) => centros.find((c) => c.id === id)?.name ?? "";

  // Al elegir una persona: prellenar nombre/apellido (mismos datos, no re-teclear) y fijar su centro
  // (evita el error "es de otro centro"). Todo queda editable.
  function pickPersonal(id: string) {
    setPersonalId(id);
    const p = sinCuenta.find((x) => x.id === id);
    if (p) {
      setNombre(p.name ?? "");
      setApellido(p.lastName ?? "");
      if (p.clinicId) setCentroId(p.clinicId);
    }
  }

  // Reset on close so the next open starts fresh (done in the handler, not an
  // effect, to avoid cascading renders).
  function handleOpenChange(next: boolean) {
    if (!next) {
      setEmail("");
      setNombre("");
      setApellido("");
      setPersonalId("");
      setCentroId("");
      setRolClave("");
      setTemporal(false);
      setVigenteHasta("");
      setResult(null);
      setCopied(false);
      setOrigenPerfilId("");
      setOrigenQuery("");
      setOrigenOpen(false);
      setCloneMsg(null);
    }
    onOpenChange(next);
  }

  async function onSubmit() {
    if (!email.trim() || !nombre.trim()) return;
    setSubmitting(true);
    const linked = sinCuenta.find((p) => p.id === personalId);
    const plan = planInvite(centroId, centros.map((c) => c.id), rolClave, linked?.clinicId);
    try {
      const res = await inviteUser({
        email: email.trim(),
        name: nombre.trim(),
        lastName: apellido.trim() || undefined,
        centerId: plan.inviteCenterId,
        rolClave: plan.inviteRole,
        // Enganchar a la persona ya dada de alta (conserva su historial). Sin esto, cuenta sin ficha.
        staffId: personalId || undefined,
        tipoAsignacion: centroId && temporal ? "temporal" : undefined,
        validUntil: centroId && temporal ? vigenteHasta || undefined : undefined,
        redirectTo: `${window.location.origin}/auth/set-password`,
      });
      toast.success(t("success", { email: res.email }));
      // "All centers": the invite carried one center; the rest and the role (with no center, so it
      // applies everywhere) are granted now. The user already exists, so a failure is a warning.
      const warnings: string[] = [];
      for (const centerId of plan.extraCenterIds) {
        try {
          await assignCenter(res.id, {
            centerId,
            type: temporal ? "temporal" : undefined,
            validUntil: temporal ? vigenteHasta || undefined : undefined,
          });
        } catch {
          warnings.push(t("centerFailed", { centro: centerName(centerId) }));
        }
      }
      if (plan.globalRole) {
        try {
          await assignRoleToProfile(res.id, plan.globalRole);
        } catch {
          warnings.push(t("roleFailed"));
        }
      }
      // «Clonar de»: el perfil ya existe → ahora se copia el acceso del origen. Falla la clonación pero no
      // el alta: el usuario queda creado y se avisa aparte (se puede reintentar la clonación por su ficha).
      if (origenPerfilId) {
        try {
          const c = await clonarAccesoDe(res.id, origenPerfilId);
          const origen = origenSel ? nombreDe(origenSel) : t("clone.origenGenerico");
          const partes = [
            t("clone.roles", { n: c.roles.copiados, ya: c.roles.yaTenia }),
            t("clone.permisos", { n: c.permisos.copiados, ya: c.permisos.yaTenia }),
            t("clone.centros", { n: c.asignaciones.copiados, ya: c.asignaciones.yaTenia }),
          ].join(" · ");
          setCloneMsg(t("clone.resumen", { origen }) + " " + partes);
          toast.success(t("clone.ok", { origen }));
        } catch (e) {
          toastError(e, tRoot); // 400 rol reservado / mismo perfil · 404 no existe → mensaje del BE
          setCloneMsg(t("clone.falloAviso"));
        }
      }
      onInvited?.();
      setResult(warnings.length ? { ...res, avisos: [...(res.avisos ?? []), ...warnings] } : res);
    } catch (err) {
      // Los errores del enlace (persona ya con cuenta / de otro centro / no existe) llegan con labelKey;
      // toastError los traduce. Llegan ANTES de crear la cuenta → se puede reintentar sin dejar nada a medias.
      toastError(err, tRoot);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyTemp() {
    if (!result?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
    } catch {
      // Clipboard blocked — the value is visible to copy manually.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {result === null ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Enlace opcional a una persona ya dada de alta (sin cuenta). Va primero: "¿a quién le doy
                  acceso?" → así el nombre llega relleno. Si no se elige, es una cuenta nueva sin ficha. */}
              <Field label={t("persona")} hint={personalId ? undefined : t("personaHint")}>
                <Select
                  value={personalId || "__none__"}
                  onValueChange={(v) => (v === "__none__" ? setPersonalId("") : pickPersonal(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("personaPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("personaNadie")}</SelectItem>
                    {sinCuenta.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.lastName ?? ""}{p.jobTitle ? ` · ${p.jobTitle}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {personalId && (
                  <p className="text-xs text-success-foreground">
                    {t("personaEnlazando", {
                      nombre: (() => { const p = sinCuenta.find((x) => x.id === personalId); return p ? `${p.name} ${p.lastName ?? ""}`.trim() : ""; })(),
                    })}
                  </p>
                )}
              </Field>
              <Field label={t("email")}>
                <EmailInput
                  value={email}
                  onValueChange={setEmail}
                  placeholder="you@email.com"
                />
              </Field>
              <Field label={t("name")}>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </Field>
              <Field label={t("lastName")}>
                <Input
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                />
              </Field>
              {suggested && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning px-3 py-2 text-xs text-warning-foreground">
                  <span>
                    {centerName(suggested.clinicId)
                      ? t("suggestion", {
                          nombre: `${suggested.name} ${suggested.lastName ?? ""}`.trim(),
                          centro: centerName(suggested.clinicId),
                        })
                      : t("suggestionNoCenter", {
                          nombre: `${suggested.name} ${suggested.lastName ?? ""}`.trim(),
                        })}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => pickPersonal(suggested.id)}>
                    {t("suggestionLink")}
                  </Button>
                </div>
              )}
              <Field label={t("centro")} hint={t("centroHint")}>
                <Select
                  value={centroId || undefined}
                  onValueChange={setCentroId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("centroPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {centros.length > 1 && (
                      <SelectItem value={ALL_CENTERS}>
                        {t("centroTodos", { n: centros.length })}
                      </SelectItem>
                    )}
                    {centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {centroId && (
                <div className="space-y-2 rounded-md bg-card p-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={temporal}
                      onCheckedChange={(v) => setTemporal(v === true)}
                    />
                    <span>{t("temporal")}</span>
                  </label>
                  {temporal && (
                    <Field label={t("vigenteHasta")}>
                      <DatePicker
                        value={vigenteHasta}
                        onChange={setVigenteHasta}
                        clearable
                      />
                    </Field>
                  )}
                </div>
              )}
              <Field label={t("rol")} hint={`${t("rolHint")} ${t("rolAdminHint")}`}>
                <Select
                  value={rolClave || undefined}
                  onValueChange={setRolClave}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("rolPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.slug}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* «Clonar de» (opcional): copia el acceso de otro usuario tras invitar. Buscador por nombre
                  o email. Solo con rbac.create. Handoff clonar-acceso-de-usuario. */}
              {puedeClonar && (
                <Field label={t("clone.label")} hint={t("clone.hint")}>
                  <div className="relative">
                    <Input
                      value={origenOpen ? origenQuery : (origenSel ? nombreDe(origenSel) : "")}
                      onChange={(e) => { setOrigenQuery(e.target.value); if (!origenOpen) setOrigenOpen(true); }}
                      onFocus={() => setOrigenOpen(true)}
                      onBlur={() => setTimeout(() => setOrigenOpen(false), 150)}
                      placeholder={t("clone.placeholder")}
                    />
                    {origenOpen && (
                      <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                        <button
                          type="button"
                          className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
                          onMouseDown={(e) => { e.preventDefault(); setOrigenPerfilId(""); setOrigenQuery(""); setOrigenOpen(false); }}
                        >
                          {t("clone.ninguno")}
                        </button>
                        {origenMatches.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full flex-col rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                            onMouseDown={(e) => { e.preventDefault(); setOrigenPerfilId(p.id); setOrigenQuery(""); setOrigenOpen(false); }}
                          >
                            <span className="font-medium">{nombreDe(p)}</span>
                            {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                          </button>
                        ))}
                        {origenMatches.length === 0 && (
                          <p className="px-2 py-2 text-xs text-muted-foreground">{t("clone.sinResultados")}</p>
                        )}
                      </div>
                    )}
                  </div>
                </Field>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {tc("cancel")}
              </Button>
              <Button
                onClick={onSubmit}
                disabled={submitting || !email.trim() || !nombre.trim()}
              >
                {submitting ? t("submitting") : t("submit")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {result.emailSent ? t("emailSentTitle") : t("tempTitle")}
              </DialogTitle>
              {!result.emailSent && (
                <DialogDescription>{t("tempHint")}</DialogDescription>
              )}
            </DialogHeader>

            {result.emailSent ? (
              <p className="text-sm text-muted-foreground">
                {t("emailSent", { email: result.email })}
              </p>
            ) : result.tempPassword ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-card px-3 py-2 font-mono text-sm break-all shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
                  {result.tempPassword}
                </code>
                <Button variant="outline" onClick={copyTemp}>
                  {copied ? t("copied") : t("copy")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("created")}</p>
            )}

            {cloneMsg && (
              <p className="mt-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
                {cloneMsg}
              </p>
            )}

            {!!result.avisos?.length && (
              <ul className="mt-2 space-y-1 rounded-md border border-warning/40 bg-warning px-3 py-2 text-xs text-warning-foreground">
                {result.avisos.map((a, i) => (
                  <li key={i}>{tRoot.has(a) ? tRoot(a) : a}</li>
                ))}
              </ul>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  handleOpenChange(false);
                  onRequestAssign?.(result);
                }}
              >
                {t("assignNow")}
              </Button>
              <Button onClick={() => handleOpenChange(false)}>{t("done")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
