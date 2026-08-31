"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification03Icon, Tick01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listAlertas,
  listTiposAlerta,
  type TipoAlerta,
  marcarLeida,
  resolverAlerta,
  descartarAlerta,
  subscribeAlertas,
  alertaHref,
  type AlertasResponse,
  type Alerta,
} from "@/lib/api/comunicaciones";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { getActiveCentro } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SEV_DOT: Record<string, string> = {
  info: "bg-info-foreground",
  warning: "bg-warning-foreground",
  critica: "bg-destructive",
};

// La CLAVE de color (verde|ambar|rojo|azul|violeta|gris) que manda el BE se mapea AQUÍ, UNA vez, a la
// paleta — no un mapa por clave de alerta (eso lo prohíbe el handoff). `dot` = punto; `border` = filo
// izquierdo de la tarjeta apilada; `text` = rótulo del grupo por dominio. Handoff alertas-color-campanita.
const COLOR: Record<string, { dot: string; border: string; text: string }> = {
  verde: { dot: "bg-success-foreground", border: "border-l-success-foreground", text: "text-success-foreground" },
  ambar: { dot: "bg-warning-foreground", border: "border-l-warning-foreground", text: "text-warning-foreground" },
  rojo: { dot: "bg-destructive", border: "border-l-destructive", text: "text-destructive" },
  azul: { dot: "bg-info-foreground", border: "border-l-info-foreground", text: "text-info-foreground" },
  violeta: { dot: "bg-violet-500", border: "border-l-violet-500", text: "text-violet-600 dark:text-violet-400" },
  gris: { dot: "bg-muted-foreground/60", border: "border-l-muted-foreground/40", text: "text-muted-foreground" },
};

// Campana de comunicaciones (canal interno). Alertas en vivo por SSE; badge de no leídas;
// acciones (resolver/descartar) y deep-link por metadata (ej. transferencia).
export function AlertasBell() {
  const t = useTranslations("comunicaciones");
  const router = useRouter();
  const { can } = useCan();
  const puedeResolver = can("alertas.resolver"); // el BE es la autoridad; esto solo evita el click a error
  const { state, refresh, reload } = useResource<AlertasResponse>(() => listAlertas());
  const alertas = state.kind === "ok" ? state.data.data : [];
  const noLeidas = state.kind === "ok" ? state.data.noLeidas : 0;
  // Catálogo de tipos → color/dominio por clave de alerta (la alerta trae `clave`, = la del tipo).
  const tiposRes = useResource<TipoAlerta[]>(() => listTiposAlerta());
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const tipoPorClave = new Map(tipos.map((tp) => [tp.clave, tp]));
  const tipoDe = (a: Alerta) => tipoPorClave.get(a.clave);
  const colorDe = (a: Alerta) => {
    const c = tipoDe(a)?.color;
    return c ? COLOR[c] ?? null : null;
  };
  // Agrupar por DOMINIO (el color ya lo insinúa). Sin dominio → "otras", al final. Orden estable.
  const grupos: Array<{ dominio: string; label: string; alertas: Alerta[] }> = [];
  for (const a of alertas) {
    const dom = tipoDe(a)?.dominio || "otras";
    let g = grupos.find((x) => x.dominio === dom);
    if (!g) { g = { dominio: dom, label: dom, alertas: [] }; grupos.push(g); }
    g.alertas.push(a);
  }
  // Distinguir "sin alertas" de "falló la carga": antes ambos se veían igual (vacío) → parecía roto.
  const fallo = state.kind === "fail";
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // SSE en vivo hasta desmontar. Reconexión con BACKOFF exponencial (3s→60s) y PARADA en 401/403:
  // sin permiso/sesión no tiene sentido reintentar cada 3s (generaba 36k UNAUTHORIZED en la bitácora).
  React.useEffect(() => {
    const ctrl = new AbortController();
    let stop = false;
    let backoff = 3000;
    async function connect() {
      while (!stop && !ctrl.signal.aborted) {
        try {
          await subscribeAlertas({
            centroId: getActiveCentro(),
            onEvent: () => refresh(),
            onOpen: () => {
              backoff = 3000; // conexión OK → reinicia el backoff
            },
            signal: ctrl.signal,
          });
        } catch (err) {
          const status = (err as { status?: number } | null)?.status;
          // 401/403 = no autorizado: dejar de reintentar (hasta re-montar / nueva sesión).
          if (status === 401 || status === 403) break;
        }
        if (stop || ctrl.signal.aborted) break;
        await new Promise((r) => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, 60000); // 3s, 6s, 12s … tope 60s
      }
    }
    void connect();
    return () => {
      stop = true;
      ctrl.abort();
    };
  }, [refresh]);

  async function onOpen(a: Alerta) {
    const href = alertaHref(a);
    try {
      await marcarLeida(a.id);
    } catch {
      /* no bloquea la navegación */
    }
    refresh();
    if (href) router.push(href);
  }

  async function act(id: string, fn: (id: string) => Promise<unknown>) {
    setBusyId(id);
    try {
      await fn(id);
      refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("bellAria")}>
          <HugeiconsIcon icon={Notification03Icon} className="size-5" />
          {fallo ? (
            // Falló la carga: punto ámbar (distinto del badge rojo de no leídas) para no confundir
            // "no hay nada" con "no pude cargar".
            <span
              title={t("loadError")}
              className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-warning-foreground ring-2 ring-background"
            />
          ) : noLeidas > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {noLeidas > 9 ? "9+" : noLeidas}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{t("title")}</span>
          <button
            type="button"
            onClick={() => router.push("/comunicaciones")}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("verTodas")}
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto py-1">
          {fallo ? (
            <div className="px-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">{t("loadError")}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                {t("retry")}
              </button>
            </div>
          ) : alertas.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            grupos.map((g) => {
              const gc = colorDe(g.alertas[0]);
              return (
                <div key={g.dominio} className="pt-1.5">
                  {/* Rótulo del dominio (el color ya lo insinúa) + cuántas hay. */}
                  <div className={cn("px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide", gc?.text ?? "text-muted-foreground")}>
                    {t.has(`dominio.${g.dominio}`) ? t(`dominio.${g.dominio}`) : g.label} · {g.alertas.length}
                  </div>
                  {/* Apiladas, no solapadas: cada alerta es su tarjeta con FILO DE COLOR a la izquierda,
                      separadas para contarlas de un vistazo. */}
                  <div className="space-y-1 px-1.5">
                    {g.alertas.map((a) => {
                      const c = colorDe(a);
                      const clickable = !!alertaHref(a);
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "group flex items-start gap-2 rounded-md border border-l-4 bg-card px-2.5 py-2 shadow-sm transition-colors hover:bg-accent/50",
                            c?.border ?? "border-l-transparent",
                          )}
                        >
                          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", c?.dot ?? SEV_DOT[a.severidad] ?? "bg-muted")} />
                          <button
                            type="button"
                            onClick={() => onOpen(a)}
                            className={cn("min-w-0 flex-1 text-left", clickable && "cursor-pointer")}
                          >
                            <p className="truncate text-sm font-medium">{a.titulo}</p>
                            {a.cuerpo && <p className="line-clamp-2 text-xs text-muted-foreground">{a.cuerpo}</p>}
                          </button>
                          {puedeResolver && (
                            <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                title={t("resolver")}
                                disabled={busyId === a.id}
                                onClick={() => act(a.id, resolverAlerta)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-success-foreground"
                              >
                                <HugeiconsIcon icon={Tick01Icon} className="size-4" />
                              </button>
                              <button
                                type="button"
                                title={t("descartar")}
                                disabled={busyId === a.id}
                                onClick={() => act(a.id, descartarAlerta)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
