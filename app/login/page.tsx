"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ForgotPasswordDialog } from "@/components/auth/forgot-password-dialog";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const t = useTranslations("login");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle")}
        </p>

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

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          {t("backHome")}
        </Link>
      </p>
    </div>
  );
}
