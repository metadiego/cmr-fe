"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";

// Where a non-approved profile lands (the SessionGate routes here). The BE
// already 403s every other endpoint; this just explains why.
export default function PendingPage() {
  const t = useTranslations("pending");
  const router = useRouter();
  const state = useMe();

  const estado = state.kind === "ok" ? state.me.estado : null;
  const message =
    estado === "rechazado"
      ? t("rejected")
      : estado === "suspendido"
        ? t("suspended")
        : t("waiting");

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-md bg-card p-6 text-center shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" className="mt-6" onClick={signOut}>
          {t("signOut")}
        </Button>
      </div>
    </div>
  );
}
