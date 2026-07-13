"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  listAlertas,
  resolverAlerta,
  descartarAlerta,
  marcarLeida,
  alertaHref,
  listPlantillas,
  type AlertasResponse,
  type Plantilla,
  type Alerta,
} from "@/lib/api/comunicaciones";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SEV_DOT: Record<string, string> = {
  info: "bg-sky-500",
  warning: "bg-amber-500",
  critica: "bg-red-500",
};

// Página del dominio único Comunicaciones: Alertas (canal interno) + Plantillas
// (notificaciones salientes). Reusa lib/api/comunicaciones — sin duplicar lógica.
export function ComunicacionesAdmin() {
  const t = useTranslations("comunicaciones");
  const [mode, setMode] = React.useState<"alertas" | "plantillas">("alertas");

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        <div className="inline-flex rounded-lg border p-0.5">
          {(["alertas", "plantillas"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === m ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`tab.${m}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("pageHelp")}</p>

      {mode === "alertas" ? <AlertasPanel /> : <PlantillasPanel />}
    </div>
  );
}

function AlertasPanel() {
  const t = useTranslations("comunicaciones");
  const tc = useTranslations("common");
  const router = useRouter();
  const { state, reload, refresh } = useResource<AlertasResponse>(() => listAlertas());
  const alertas = state.kind === "ok" ? state.data.data : [];
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function open(a: Alerta) {
    const href = alertaHref(a);
    try { await marcarLeida(a.id); } catch { /* noop */ }
    refresh();
    if (href) router.push(href);
  }
  async function act(id: string, fn: (id: string) => Promise<unknown>) {
    setBusyId(id);
    try { await fn(id); refresh(); }
    catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setBusyId(null); }
  }

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (state.kind === "fail")
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{tc("error")}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
      </div>
    );
  if (alertas.length === 0)
    return <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="divide-y rounded-xl border">
      {alertas.map((a) => {
        const clickable = !!alertaHref(a);
        return (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
            <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", SEV_DOT[a.severidad] ?? "bg-muted")} />
            <button type="button" onClick={() => open(a)} className={cn("min-w-0 flex-1 text-left", clickable && "cursor-pointer")}>
              <p className="font-medium">{a.titulo}</p>
              {a.cuerpo && <p className="text-sm text-muted-foreground">{a.cuerpo}</p>}
            </button>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => act(a.id, resolverAlerta)}>{t("resolver")}</Button>
              <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => act(a.id, descartarAlerta)}>{t("descartar")}</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlantillasPanel() {
  const t = useTranslations("comunicaciones");
  const tc = useTranslations("common");
  const { state, reload } = useResource<Plantilla[]>(() => listPlantillas());
  const rows = state.kind === "ok" ? state.data : [];

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-semibold">{t("col.clave")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.canal")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.idioma")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.asunto")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {state.kind === "loading" && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
          )}
          {state.kind === "fail" && (
            <tr><td colSpan={5} className="px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{tc("error")}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
            </td></tr>
          )}
          {state.kind === "ok" && rows.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{t("noPlantillas")}</td></tr>
          )}
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30">
              <td className="px-3 py-2 font-mono text-xs">{p.clave}</td>
              <td className="px-3 py-2"><Badge variant="outline">{p.canal}</Badge></td>
              <td className="px-3 py-2 uppercase text-muted-foreground">{p.idioma}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.asunto ?? "—"}</td>
              <td className="px-3 py-2"><Badge variant={p.activo ? "secondary" : "outline"}>{p.activo ? tc("active") : tc("inactive")}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
