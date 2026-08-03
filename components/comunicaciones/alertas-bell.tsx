"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification03Icon, Tick01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listAlertas,
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
  info: "bg-sky-500",
  warning: "bg-amber-500",
  critica: "bg-red-500",
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
              className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-amber-500 ring-2 ring-background"
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
            alertas.map((a) => {
              const clickable = !!alertaHref(a);
              return (
                <div key={a.id} className="group flex items-start gap-2 px-3 py-2 hover:bg-accent/50">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", SEV_DOT[a.severidad] ?? "bg-muted")} />
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
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-green-600"
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
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
