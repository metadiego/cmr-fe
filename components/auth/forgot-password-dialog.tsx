"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// "Forgot password": sends a Supabase recovery email whose link lands on
// /auth/set-password (which handles type=recovery). redirectTo is per-request so
// it works in dev and prod.
export function ForgotPasswordDialog() {
  const t = useTranslations("login");
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) setEmail("");
    setOpen(next);
  }

  async function onSend() {
    if (!email.trim()) return;
    setSending(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth/set-password` },
      );
      if (error) throw error;
      toast.success(t("forgotSent"));
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("forgot")}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("forgotTitle")}</DialogTitle>
          <DialogDescription>{t("forgotDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">{t("email")}</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={onSend} disabled={sending || !email.trim()}>
            {sending ? t("forgotSending") : t("forgotSend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
