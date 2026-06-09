"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { getMe, type Me } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

type State =
  | { kind: "loading" }
  | { kind: "ok"; me: Me }
  | { kind: "fail"; message: string };

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getMe()
      .then((me) => {
        if (active) setState({ kind: "ok", me });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message =
          err instanceof ApiError
            ? `${err.status} · ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        setState({ kind: "fail", message });
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/appearance">{t("appearance")}</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            disabled={signingOut}
          >
            {signingOut ? t("signingOut") : t("signOut")}
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur">
        {state.kind === "loading" && (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        )}

        {state.kind === "fail" && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t.rich("loadError", {
              message: state.message,
              code: (chunks) => <code>{chunks}</code>,
            })}
          </p>
        )}

        {state.kind === "ok" && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <Row k="email" v={state.me.email ?? "—"} />
            <Row k="estado" v={state.me.estado ?? "—"} />
            <Row k="isMaster" v={String(state.me.isMaster)} />
            <Row k="accessMode" v={state.me.accessMode} />
            <Row k="roles" v={state.me.roles.join(", ") || "—"} />
            <Row
              k="allowedClinicIds"
              v={state.me.allowedClinicIds.join(", ") || tCommon("all")}
            />
            <Row k="activeClinicId" v={state.me.activeClinicId ?? "—"} />
            <Row k="perfilId" v={state.me.perfilId ?? "—"} />
          </dl>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono break-all">{v}</dd>
    </>
  );
}
