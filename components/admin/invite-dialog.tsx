"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  inviteUser,
  type InviteResponse,
  type Perfil,
} from "@/lib/api/profiles";
import { getCenters } from "@/lib/api/centers";
import { getRoles } from "@/lib/api/rbac";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
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

  const [email, setEmail] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [apellido, setApellido] = React.useState("");
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

  // Reset on close so the next open starts fresh (done in the handler, not an
  // effect, to avoid cascading renders).
  function handleOpenChange(next: boolean) {
    if (!next) {
      setEmail("");
      setNombre("");
      setApellido("");
      setAccessMode("operativo");
      setCentroId("");
      setRolClave("");
      setTemporal(false);
      setVigenteHasta("");
      setResult(null);
      setCopied(false);
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
        tipoAsignacion: centroId && temporal ? "temporal" : undefined,
        vigenteHasta: centroId && temporal ? vigenteHasta || undefined : undefined,
        redirectTo: `${window.location.origin}/auth/set-password`,
      });
      toast.success(t("success", { email: res.email }));
      onInvited?.();
      setResult(res);
    } catch (err) {
      toast.error(apiErrorMessage(err));
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
