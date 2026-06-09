"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const MIN_LENGTH = 8;

// Landing page for the Supabase invitation magic link (redirect_to =
// INVITE_REDIRECT_URL on the BE). The link carries the session (hash tokens, or
// a PKCE ?code=); once it's established the invited user sets their own password.
export default function SetPasswordPage() {
  const t = useTranslations("setPassword");
  // Guard: only a real invite/recovery link is valid here. Capture the URL tokens
  // at first render, before @supabase/ssr processes and clears the hash. Without a
  // token we refuse — a normal logged-in session must NOT be able to change its
  // password on this page (that caused the master-password incident).
  const [hasAuthLink] = React.useState(() => {
    if (typeof window === "undefined") return false;
    const hasHashToken = /access_token=|type=(invite|recovery)/.test(
      window.location.hash,
    );
    const hasCode = new URLSearchParams(window.location.search).has("code");
    return hasHashToken || hasCode;
  });
  const supabase = React.useMemo(() => createClient(), []);
  const [phase, setPhase] = React.useState<"verifying" | "ready" | "invalid">(
    hasAuthLink ? "verifying" : "invalid",
  );
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!hasAuthLink) return;
    let settled = false;
    const ready = () => {
      if (!settled) {
        settled = true;
        setPhase("ready");
      }
    };

    // PKCE: ?code= in the URL → exchange it for a session.
    const code = new URL(window.location.href).searchParams.get("code");
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => !error && ready());
    }
    // Implicit/hash: @supabase/ssr auto-detects the session from the URL hash.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) ready();
    });
    supabase.auth.getSession().then(({ data }) => data.session && ready());

    // No session shortly after → the link is invalid or expired.
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setPhase("invalid");
      }
    }, 4000);

    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [supabase, hasAuthLink]);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    password.length >= MIN_LENGTH && password === confirm && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("success"));
      // Hard navigation so the session is read fresh on /dashboard.
      window.location.assign("/dashboard");
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>

        {phase === "verifying" && (
          <p className="mt-2 text-sm text-muted-foreground">{t("verifying")}</p>
        )}

        {phase === "invalid" && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{t("invalid")}</p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href="/login">{t("backToLogin")}</Link>
            </Button>
          </>
        )}

        {phase === "ready" && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("description")}
            </p>
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
          </>
        )}
      </div>
    </div>
  );
}
