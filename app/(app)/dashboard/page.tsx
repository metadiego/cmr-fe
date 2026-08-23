"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { getMe, type Me } from "@/lib/api/auth";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { ApiError } from "@/lib/api/types";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";

type State =
  | { kind: "loading" }
  | { kind: "ok"; me: Me }
  | { kind: "fail"; message: string };

function iniciales(me: Me): string {
  const n = (me.nombre ?? "").trim();
  const a = (me.apellido ?? "").trim();
  if (n || a) return `${n[0] ?? ""}${a[0] ?? ""}`.toUpperCase() || "?";
  const e = (me.email ?? "?").trim();
  return e.slice(0, 2).toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { can } = useCan();
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [signingOut, setSigningOut] = React.useState(false);
  const [verDetalles, setVerDetalles] = React.useState(false);

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];

  React.useEffect(() => {
    let active = true;
    getMe()
      .then((me) => { if (active) setState({ kind: "ok", me }); })
      .catch((err: unknown) => {
        if (!active) return;
        const message =
          err instanceof ApiError ? `${err.status} · ${err.message}`
          : err instanceof Error ? err.message : String(err);
        setState({ kind: "fail", message });
      });
    return () => { active = false; };
  }, []);

  async function logout() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/login");
  }

  const me = state.kind === "ok" ? state.me : null;
  const nombreVisible = me ? ([me.nombre, me.apellido].filter(Boolean).join(" ").trim() || me.email || "—") : "";
  const puesto = me ? (me.roles.join(", ") || (me.isMaster ? "master" : "—")) : "";
  const centroNombre = me?.activeClinicId ? (centros.find((c) => c.id === me.activeClinicId)?.nombre ?? "") : "";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/settings/appearance">{t("appearance")}</Link></Button>
          <Button variant="outline" size="sm" asChild><Link href="/settings/tableros">{t("myBoards")}</Link></Button>
          {can("tablero.admin") && (
            <Button variant="outline" size="sm" asChild><Link href="/settings/tablero-modulos">{t("boardModules")}</Link></Button>
          )}
          <Button variant="outline" size="sm" onClick={logout} disabled={signingOut}>{signingOut ? t("signingOut") : t("signOut")}</Button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur">
        {state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {state.kind === "fail" && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {t.rich("loadError", { message: state.message, code: (chunks) => <code>{chunks}</code> })}
          </p>
        )}

        {me && (
          <>
            {/* Identidad de la persona (no el volcado técnico): avatar, nombre, puesto y centro. */}
            <div className="flex items-center gap-4">
              {me.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatarUrl} alt="" className="size-16 rounded-full object-cover" />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">{iniciales(me)}</div>
              )}
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{nombreVisible}</div>
                <div className="text-sm capitalize text-muted-foreground">{puesto}</div>
                {centroNombre && <div className="mt-0.5 text-sm text-muted-foreground">{t("en")} <span className="font-medium text-foreground">{centroNombre}</span></div>}
              </div>
            </div>

            {/* Los identificadores técnicos: solo si se piden. */}
            <button type="button" onClick={() => setVerDetalles((v) => !v)} className="mt-4 text-xs font-medium text-primary hover:underline">
              {verDetalles ? t("ocultarDetalles") : t("verDetalles")}
            </button>
            {verDetalles && (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t pt-3 text-sm">
                <Row k="email" v={me.email ?? "—"} />
                <Row k="estado" v={me.estado ?? "—"} />
                <Row k="isMaster" v={String(me.isMaster)} />
                <Row k="accessMode" v={me.accessMode} />
                <Row k="roles" v={me.roles.join(", ") || "—"} />
                <Row k="allowedClinicIds" v={me.allowedClinicIds.join(", ") || tCommon("all")} />
                <Row k="activeClinicId" v={me.activeClinicId ?? "—"} />
                <Row k="perfilId" v={me.perfilId ?? "—"} />
              </dl>
            )}
          </>
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
