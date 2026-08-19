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
  // Los tokens del enlace, capturados en el PRIMER render. Los enlaces de invitación y recuperación de
  // Supabase entregan la sesión en el fragmento (`#access_token=…&refresh_token=…`), pero el cliente de
  // `@supabase/ssr` va en flujo PKCE: LIMPIA el hash y no lo canjea, porque PKCE espera `?code=` con su
  // verifier. Resultado: no había sesión nunca, y a los 4 s esta pantalla decía «el enlace no es válido o
  // ya expiró» — con el enlace intacto. No era el correo ni Outlook: no funcionaba para nadie.
  // Verificado con navegador real el 19-ago: hash consumido, cero cookies de sesión, cero errores de red.
  const [linkTokens] = React.useState(() => {
    if (typeof window === "undefined") return null;
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access_token = h.get("access_token");
    const refresh_token = h.get("refresh_token");
    return access_token && refresh_token ? { access_token, refresh_token } : null;
  });
  const supabase = React.useMemo(() => createClient(), []);
  // Sin enlace en la URL NO es "inválido": es que hay que usar un CÓDIGO de acceso (el admin lo entrega).
  // El bucle "enlace no válido" venía de arrancar en "invalid" sin enlace. Handoff codigo-de-acceso.
  const [phase, setPhase] = React.useState<"verifying" | "ready" | "invalid" | "codigo">(
    hasAuthLink ? "verifying" : "codigo",
  );
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  // Modo "tengo un código": el usuario canjea el código de 8 caracteres y fija SU contraseña.
  const [email, setEmail] = React.useState("");
  const [codigo, setCodigo] = React.useState("");

  React.useEffect(() => {
    if (!hasAuthLink) return;
    let settled = false;
    const ready = () => {
      if (!settled) {
        settled = true;
        setPhase("ready");
      }
    };

    // Enlace IMPLÍCITO (invitación y recuperación): la sesión viene en el fragmento y hay que
    // establecerla a mano. Es lo que faltaba: el cliente en PKCE limpiaba el hash sin canjearlo.
    if (linkTokens) {
      supabase.auth.setSession(linkTokens).then(({ error }) => {
        if (!error) ready();
      });
    }
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
  }, [supabase, hasAuthLink, linkTokens]);

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

  // Modo código: canjea el código (verifyOtp type recovery, es el que emite el BE) → con sesión, fija la
  // contraseña. Mensajes DISTINTOS por caso (nunca genérico). El código NO se registra en ningún lado.
  const canjearValido = email.trim().length > 3 && codigo.trim().length >= 6 && password.length >= MIN_LENGTH && password === confirm && !submitting;
  async function onCanjear(e: React.FormEvent) {
    e.preventDefault();
    if (!canjearValido) return;
    setSubmitting(true);
    try {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: codigo.trim(),
        type: "recovery",
      });
      if (otpErr) {
        const msg = String(otpErr.message ?? "");
        const code = (otpErr as { code?: string }).code ?? "";
        const key = /expired|otp_expired/i.test(code + msg)
          ? "codigoErr.expirado"
          : /email|not found/i.test(msg)
            ? "codigoErr.correo"
            : "codigoErr.incorrecto";
        toast.error(t(key));
        setSubmitting(false);
        return;
      }
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
      toast.success(t("success"));
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
            {/* El enlace SÍ existía y falló (caducó / de un solo uso). Se ofrece la vía del código. */}
            <p className="mt-2 text-sm text-muted-foreground">{t("invalid")}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => setPhase("codigo")}>{t("usarCodigo")}</Button>
              <Button variant="outline" asChild>
                <Link href="/login">{t("backToLogin")}</Link>
              </Button>
            </div>
          </>
        )}

        {phase === "codigo" && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{t("codigoIntro")}</p>
            <form onSubmit={onCanjear} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cod-email">{t("email")}</Label>
                <Input id="cod-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cod-codigo">{t("codigo")}</Label>
                <Input id="cod-codigo" inputMode="text" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={t("codigoPlaceholder")} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cod-password">{t("newPassword")}</Label>
                <Input id="cod-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                {tooShort && <p className="text-xs text-destructive">{t("tooShort", { min: MIN_LENGTH })}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cod-confirm">{t("confirm")}</Label>
                <Input id="cod-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                {mismatch && <p className="text-xs text-destructive">{t("mismatch")}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={!canjearValido}>
                {submitting ? t("submitting") : t("submit")}
              </Button>
            </form>
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
