"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { positionLabel } from "@/lib/personal/positions";
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
import { missingFields } from "@/lib/forms/missing";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { useDialogForm } from "@/components/kit/use-dialog-form";
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

  // Everything the dialog holds, re-initialised each time it opens.
  // `personalId`: optional link to a staff record that has no login yet — the new account attaches to
  // that record and keeps its history. "" = an account with no staff record, as before.
  // `centroId` + `rolClave`: center and role in the same step (otherwise the invitee is born with no
  // access and their first login is a 403).
  const [form, update] = useDialogForm(
    () => ({
      email: "",
      nombre: "",
      apellido: "",
      personalId: "",
      centroId: "",
      rolClave: "",
      temporal: false,
      vigenteHasta: "",
      origenPerfilId: "",
      origenQuery: "",
      origenOpen: false,
      result: null as InviteResponse | null,
      copied: false,
      cloneMsg: null as string | null,
    }),
    open,
  );
  const { email, nombre, apellido, personalId, centroId, rolClave, temporal, vigenteHasta } = form;
  const { origenPerfilId, origenQuery, origenOpen, result, copied, cloneMsg } = form;
  // "Clone from": copy another profile's access to the new one (after inviting). Since cmr-be #557
  // only an admin manages access, so the field is shown to admins only.
  const meState = useMe();
  const puedeClonar = meState.kind === "ok" && isAdmin(meState.me);
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
  // Staff records WITHOUT a login (profileId === null): candidates to link. 65 active in Caguas fit in
  // one page; if they ever stop fitting, the BE will offer `?sinCuenta=true`.
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

  // Picking a person pre-fills first/last name (same data, no retyping) and sets their center (avoids
  // the "belongs to another center" error). Everything stays editable.
  function pickPersonal(id: string) {
    const p = sinCuenta.find((x) => x.id === id);
    update(
      p
        ? {
            personalId: id,
            nombre: p.name ?? "",
            apellido: p.lastName ?? "",
            ...(p.clinicId ? { centroId: p.clinicId } : {}),
          }
        : { personalId: id },
    );
  }

  const missing = missingFields([
    [t("email"), !!email.trim()],
    [t("name"), !!nombre.trim()],
  ]);

  const { submitting, submit } = useSubmit(async () => {
    const linked = sinCuenta.find((p) => p.id === personalId);
    const plan = planInvite(centroId, centros.map((c) => c.id), rolClave, linked?.clinicId);
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
    // "Clone from": the profile now exists → copy the source's access. A failed clone does not fail the
    // invite: the user is created and warned separately (cloning can be retried from their record).
    if (origenPerfilId) {
      try {
        const c = await clonarAccesoDe(res.id, origenPerfilId);
        const origen = origenSel ? nombreDe(origenSel) : t("clone.origenGenerico");
        const partes = [
          t("clone.roles", { n: c.roles.copiados, ya: c.roles.yaTenia }),
          t("clone.permisos", { n: c.permisos.copiados, ya: c.permisos.yaTenia }),
          t("clone.centros", { n: c.asignaciones.copiados, ya: c.asignaciones.yaTenia }),
        ].join(" · ");
        update({ cloneMsg: t("clone.resumen", { origen }) + " " + partes });
        toast.success(t("clone.ok", { origen }));
      } catch (e) {
        toastError(e, tRoot); // 400 reserved role / same profile · 404 not found → the BE message
        update({ cloneMsg: t("clone.falloAviso") });
      }
    }
    onInvited?.();
    update({ result: warnings.length ? { ...res, avisos: [...(res.avisos ?? []), ...warnings] } : res });
    // Link errors (person already has an account / other center / not found) arrive with a labelKey and
    // useSubmit's toast translates them. They arrive BEFORE the account is created → safe to retry.
  });

  async function copyTemp() {
    if (!result?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(result.tempPassword);
      update({ copied: true });
    } catch {
      // Clipboard blocked — the value is visible to copy manually.
    }
  }

  if (result !== null) {
    // Second step: what was created (email sent or a temporary password to hand over). A viewer.
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{result.emailSent ? t("emailSentTitle") : t("tempTitle")}</DialogTitle>
            {!result.emailSent && <DialogDescription>{t("tempHint")}</DialogDescription>}
          </DialogHeader>

          {result.emailSent ? (
            <p className="text-sm text-muted-foreground">{t("emailSent", { email: result.email })}</p>
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
                onOpenChange(false);
                onRequestAssign?.(result);
              }}
            >
              {t("assignNow")}
            </Button>
            <Button onClick={() => onOpenChange(false)}>{t("done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const personaEnlazada = sinCuenta.find((x) => x.id === personalId);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("title")}
      description={t("description")}
      // Sending an invite is outward (it emails the person): Enter in any field never fires it,
      // only the button. EmailInput still completes the domain on Enter.
      onSubmit={() => {}}
      actions={[{ label: t("submit"), onClick: () => submit() }]}
      submitting={submitting}
      missing={missing}
      submittingLabel={t("submitting")}
      cancelLabel={tc("cancel")}
    >
      {/* Optional link to a staff record with no login. It goes first ("who am I giving access to?")
          so the name arrives filled in. Left empty, it is a new account with no record. */}
      <Field
        label={t("persona")}
        htmlFor="invite-staff"
        hint={personalId ? undefined : t("personaHint")}
      >
        <Select
          value={personalId || "__none__"}
          onValueChange={(v) => (v === "__none__" ? update({ personalId: "" }) : pickPersonal(v))}
        >
          <SelectTrigger id="invite-staff" className="w-full">
            <SelectValue placeholder={t("personaPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("personaNadie")}</SelectItem>
            {sinCuenta.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} {p.lastName ?? ""}
                {p.jobTitle ? ` · ${positionLabel(p.jobTitle, tRoot)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {personalId && (
          <p className="text-xs text-success-foreground">
            {t("personaEnlazando", {
              nombre: personaEnlazada
                ? `${personaEnlazada.name} ${personaEnlazada.lastName ?? ""}`.trim()
                : "",
            })}
          </p>
        )}
      </Field>
      <Field label={t("email")} htmlFor="invite-email" required>
        <EmailInput
          id="invite-email"
          value={email}
          onValueChange={(v) => update({ email: v })}
          placeholder="you@email.com"
        />
      </Field>
      <Field label={t("name")} htmlFor="invite-name" required>
        <Input
          id="invite-name"
          value={nombre}
          onChange={(e) => update({ nombre: e.target.value })}
        />
      </Field>
      <Field label={t("lastName")} htmlFor="invite-last-name">
        <Input
          id="invite-last-name"
          value={apellido}
          onChange={(e) => update({ apellido: e.target.value })}
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
      <Field label={t("centro")} htmlFor="invite-center" hint={t("centroHint")}>
        <Select value={centroId || undefined} onValueChange={(v) => update({ centroId: v })}>
          <SelectTrigger id="invite-center" className="w-full">
            <SelectValue placeholder={t("centroPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {centros.length > 1 && (
              <SelectItem value={ALL_CENTERS}>{t("centroTodos", { n: centros.length })}</SelectItem>
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
            <Checkbox checked={temporal} onCheckedChange={(v) => update({ temporal: v === true })} />
            <span>{t("temporal")}</span>
          </label>
          {temporal && (
            <Field label={t("vigenteHasta")}>
              <DatePicker
                value={vigenteHasta}
                onChange={(v) => update({ vigenteHasta: v })}
                clearable
              />
            </Field>
          )}
        </div>
      )}
      <Field label={t("rol")} htmlFor="invite-role" hint={`${t("rolHint")} ${t("rolAdminHint")}`}>
        <Select value={rolClave || undefined} onValueChange={(v) => update({ rolClave: v })}>
          <SelectTrigger id="invite-role" className="w-full">
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

      {/* "Clone from" (optional): copies another user's access after inviting. Searches by name or
          email. Admins only. Handoff clonar-acceso-de-usuario. */}
      {puedeClonar && (
        <Field label={t("clone.label")} htmlFor="invite-clone-from" hint={t("clone.hint")}>
          <div className="relative">
            <Input
              id="invite-clone-from"
              value={origenOpen ? origenQuery : origenSel ? nombreDe(origenSel) : ""}
              onChange={(e) => update({ origenQuery: e.target.value, origenOpen: true })}
              onFocus={() => update({ origenOpen: true })}
              onBlur={() => setTimeout(() => update({ origenOpen: false }), 150)}
                  placeholder={t("clone.placeholder")}
            />
            {origenOpen && (
              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                <button
                  type="button"
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    update({ origenPerfilId: "", origenQuery: "", origenOpen: false });
                  }}
                >
                  {t("clone.ninguno")}
                </button>
                {origenMatches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full flex-col rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      update({ origenPerfilId: p.id, origenQuery: "", origenOpen: false });
                    }}
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
    </FormDialog>
  );
}
