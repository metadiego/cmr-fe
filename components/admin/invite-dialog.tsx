"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  inviteUser,
  getProfiles,
  type InviteResponse,
  type Perfil,
} from "@/lib/api/profiles";
import { getCenters } from "@/lib/api/centers";
import { getRoles, clonarAccesoDe } from "@/lib/api/rbac";
import { listPersonal, type Personal } from "@/lib/api/personal";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

type AccessMode = "operativo" | "gerencial";

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
  const [accessMode, setAccessMode] = React.useState<AccessMode>("operativo");
  // Invite ampliado: centro + rol en el mismo paso (si no, el invitado nace sin
  // accesos y su primer login es un 403).
  const [centroId, setCentroId] = React.useState("");
  const [rolClave, setRolClave] = React.useState("");
  const [temporal, setTemporal] = React.useState(false);
  const [vigenteHasta, setVigenteHasta] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<InviteResponse | null>(null);
  const [copied, setCopied] = React.useState(false);
  // «Clonar de»: copiar el acceso de otro perfil al nuevo (tras invitar). Solo con rbac.create.
  const { can } = useCan();
  const puedeClonar = can("rbac.create");
  const [origenPerfilId, setOrigenPerfilId] = React.useState("");
  const [origenQuery, setOrigenQuery] = React.useState("");
  const [origenOpen, setOrigenOpen] = React.useState(false);
  const [cloneMsg, setCloneMsg] = React.useState<string | null>(null);
  const { state: perfilesState } = useResource(
    () => (open && puedeClonar ? getProfiles(1, 200) : Promise.resolve([] as Perfil[])),
    [open, puedeClonar],
  );
  const perfiles = perfilesState.kind === "ok" ? perfilesState.data : [];
  const nombreDe = (p: Perfil) => [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || p.email || p.id;
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
  const roles = rolesState.kind === "ok" ? rolesState.data : [];
  // Personas dadas de alta SIN cuenta (perfilId === null): candidatas a enganchar. 65 activas en Caguas
  // → entran en una página; si algún día no cupieran, el BE ofrecerá `?sinCuenta=true`.
  const { state: personalState } = useResource(
    () => (open ? listPersonal({ limit: 100 }).then((r) => r.items) : Promise.resolve([] as Personal[])),
    [open],
  );
  const sinCuenta = (personalState.kind === "ok" ? personalState.data : [])
    .filter((p) => p.perfilId == null && p.activo !== false)
    .sort((a, b) => `${a.nombre} ${a.apellido ?? ""}`.localeCompare(`${b.nombre} ${b.apellido ?? ""}`));

  // Al elegir una persona: prellenar nombre/apellido (mismos datos, no re-teclear) y fijar su centro
  // (evita el error "es de otro centro"). Todo queda editable.
  function pickPersonal(id: string) {
    setPersonalId(id);
    const p = sinCuenta.find((x) => x.id === id);
    if (p) {
      setNombre(p.nombre ?? "");
      setApellido(p.apellido ?? "");
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
      setAccessMode("operativo");
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
    try {
      const res = await inviteUser({
        email: email.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim() || undefined,
        accessMode,
        centroId: centroId || undefined,
        rolClave: rolClave || undefined,
        // Enganchar a la persona ya dada de alta (conserva su historial). Sin esto, cuenta sin ficha.
        personalId: personalId || undefined,
        tipoAsignacion: centroId && temporal ? "temporal" : undefined,
        vigenteHasta: centroId && temporal ? vigenteHasta || undefined : undefined,
        redirectTo: `${window.location.origin}/auth/set-password`,
      });
      toast.success(t("success", { email: res.email }));
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
          const modo = c.accessMode.antes !== c.accessMode.ahora ? " " + t("clone.modo", { modo: c.accessMode.ahora }) : "";
          setCloneMsg(t("clone.resumen", { origen }) + " " + partes + modo);
          toast.success(t("clone.ok", { origen }));
        } catch (e) {
          toastError(e, tRoot); // 400 rol reservado / mismo perfil · 404 no existe → mensaje del BE
          setCloneMsg(t("clone.falloAviso"));
        }
      }
      onInvited?.();
      setResult(res);
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
      <DialogContent>
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
                        {p.nombre} {p.apellido ?? ""}{p.cargo ? ` · ${p.cargo}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {personalId && (
                  <p className="text-xs text-success-foreground">
                    {t("personaEnlazando", {
                      nombre: (() => { const p = sinCuenta.find((x) => x.id === personalId); return p ? `${p.nombre} ${p.apellido ?? ""}`.trim() : ""; })(),
                    })}
                  </p>
                )}
              </Field>
              <Field label={t("email")}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="off"
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
              <Field label={t("accessMode")}>
                <Select
                  value={accessMode}
                  onValueChange={(v) => setAccessMode(v as AccessMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operativo">{t("operativo")}</SelectItem>
                    <SelectItem value="gerencial">{t("gerencial")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("centro")} hint={t("centroHint")}>
                <Select
                  value={centroId || undefined}
                  onValueChange={setCentroId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("centroPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {centroId && (
                <div className="space-y-2 rounded-lg border p-3">
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={temporal}
                      onCheckedChange={(v) => setTemporal(v === true)}
                    />
                    <span>{t("temporal")}</span>
                  </label>
                  {temporal && (
                    <Field label={t("vigenteHasta")}>
                      <Input
                        type="date"
                        value={vigenteHasta}
                        onChange={(e) => setVigenteHasta(e.target.value)}
                      />
                    </Field>
                  )}
                </div>
              )}
              <Field label={t("rol")} hint={t("rolHint")}>
                <Select
                  value={rolClave || undefined}
                  onValueChange={setRolClave}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("rolPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.clave}>
                        {r.nombre}
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
                <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
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
