"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Stethoscope02Icon } from "@hugeicons/core-free-icons";

import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ForgotPasswordDialog } from "@/components/auth/forgot-password-dialog";

const initialState: LoginState = {};

export default function LoginPage() {
  // useSearchParams exige un límite de Suspense; el contenido real vive en LoginForm.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const t = useTranslations("login");
  // Aviso cuando el usuario llega aquí porque su sesión expiró (redirigido con ?expired=1). Refuerza el
  // toast del cliente de API para que el motivo quede claro también en la pantalla de login (QA-001).
  const expirada = useSearchParams().has("expired");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-muted px-6 py-12">
      <div className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <HugeiconsIcon icon={Stethoscope02Icon} className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">CMR</span>
      </div>
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle")}
        </p>

        {expirada && (
          <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
            {t("sessionExpired")}
          </p>
        )}

        <form action={formAction} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">
              {t("email")}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder={t("emailPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">
              {t("password")}
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="flex justify-end">
            <ForgotPasswordDialog />
          </div>

          {state.error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("signingIn") : t("signIn")}
          </Button>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
