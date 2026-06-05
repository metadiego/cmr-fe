"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  inviteUser,
  type InviteResponse,
  type Perfil,
} from "@/lib/api/profiles";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
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
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<InviteResponse | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Reset on close so the next open starts fresh (done in the handler, not an
  // effect, to avoid cascading renders).
  function handleOpenChange(next: boolean) {
    if (!next) {
      setEmail("");
      setNombre("");
      setApellido("");
      setAccessMode("operativo");
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
