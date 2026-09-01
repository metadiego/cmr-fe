"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { markPasswordChanged } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const MIN_LENGTH = 8;

// Forced temp-password change (SessionGate routes invited users here while
// mustChangePassword is true). Sets the password in Supabase Auth, then clears
// the BE flag, then hard-navigates so the gate re-reads /auth/me.
export default function ChangePasswordPage() {
  const t = useTranslations("password");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    password.length >= MIN_LENGTH && password === confirm && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      await markPasswordChanged();
      toast.success(t("success"));
      // Hard navigation so SessionGate (in the persistent layout) refetches
      // /auth/me and sees mustChangePassword=false — avoids a redirect loop.
      window.location.assign("/dashboard");
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">
              {t("newPassword")}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {tooShort && (
              <p className="text-xs text-destructive">
                {t("tooShort", { min: MIN_LENGTH })}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">
              {t("confirm")}
            </Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {mismatch && (
              <p className="text-xs text-destructive">{t("mismatch")}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
