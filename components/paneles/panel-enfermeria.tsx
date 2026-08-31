"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { VolumeHighIcon } from "@hugeicons/core-free-icons";

import {
  getPanelDefinicion,
  getPanelNotificaciones,
  aceptarNotificacion,
  cancelarNotificacion,
  type PanelDefinicion,
  type PanelNotificacion,
} from "@/lib/api/paneles";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useCan } from "@/hooks/use-can";
import { colorForName } from "@/lib/frontdesk/color";

const CLAVE = "enfermeria";

// Tono por SECCIÓN: el nombre lógico (`panel_secciones.audio`) decide cómo suena, para que la enfermera
// sepa cuál sonó sin mirar la pantalla. Se distinguen de verdad (una quinta + otro timbre, no 880 vs 900).
// Un nombre desconocido NUNCA queda mudo: cae al tono por defecto. El BE nombra, el FE resuelve el sonido.
type Tono = { hz: number; tipo: OscillatorType };
const TONO_DEFAULT: Tono = { hz: 880, tipo: "sine" };
const TONOS: Record<string, Tono> = {
  vitales: { hz: 880, tipo: "sine" },
  intravenoso: { hz: 587, tipo: "triangle" }, // más grave y con otro timbre
};
function tonoDe(audio?: string | null): Tono {
  return (audio && TONOS[audio]) || TONO_DEFAULT;
}

// Tinte suave (~12% alfa) a partir de un color hex del BE; si no es hex de 6 dígitos, sin tinte.
function tinteHex(color?: string | null): string | undefined {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}1f` : undefined;
}

// Alarma sin assets: beep en loop con WebAudio (requiere un primer gesto por autoplay del navegador).
function useAlarma() {
  const ctxRef = React.useRef<AudioContext | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const tonoRef = React.useRef<Tono>(TONO_DEFAULT);
  const armado = React.useRef(false);
  const armar = () => {
    if (armado.current) return;
    try { ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); armado.current = true; } catch { /* noop */ }
  };
  const beep = () => {
    const ctx = ctxRef.current; if (!ctx) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    // Tono de la sección del aviso actual (se actualiza en cada start; el loop lo lee en cada beep).
    o.frequency.value = tonoRef.current.hz; o.type = tonoRef.current.tipo; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.42);
  };
  // `tono` se aplica SIEMPRE (aunque el loop ya esté sonando, para que un cambio de sección se oiga).
  const start = (tono?: Tono) => { tonoRef.current = tono ?? TONO_DEFAULT; if (timerRef.current || !armado.current) return; beep(); timerRef.current = setInterval(beep, 1200); };
  const stop = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  React.useEffect(() => () => stop(), []);
  return { armar, armado, start, stop };
}

export function PanelEnfermeria({ centro }: { centro?: string }) {
  const t = useTranslations("panel");
  const tRoot = useTranslations();
  const { can } = useCan();
  const puedeAceptar = can("panel.aceptar");
  const puedeCancelar = can("panel.notificar");

  const defRes = useResource<PanelDefinicion>(() => getPanelDefinicion(CLAVE, centro), [centro]);
  const [notifs, setNotifs] = React.useState<PanelNotificacion[]>([]);
  const alarma = useAlarma();

  // Los contadores del día YA vienen en la definición → sin llamada aparte (dedup). En cada evento
  // SSE se recarga la definición (trae contadores frescos) + las notificaciones pendientes.
  const refetch = React.useCallback(() => {
    defRes.reload();
    getPanelNotificaciones(CLAVE, centro).then(setNotifs).catch(() => {});
  }, [defRes, centro]);
  // Carga inicial (una vez montado, patrón sin setState-en-render).
  React.useEffect(() => {
    getPanelNotificaciones(CLAVE, centro).then(setNotifs).catch(() => {});
  }, [centro]);

  const { live } = useCitaStream({ centroId: centro ?? null, entidad: "panel_notificacion", onInvalidate: refetch });

  // Cola: la más antigua primero. La alarma suena mientras haya avisos pendientes.
  const pendientes = notifs;
  const actual = pendientes[0] ?? null;

  const def = defRes.state.kind === "ok" ? defRes.state.data : null;
  const secciones = (def?.secciones ?? []).slice().sort((a, b) => a.orden - b.orden);
  // El sonido depende de la SECCIÓN del aviso actual: su `audio` (lo enriquece el BE en la notificación;
  // respaldo a la sección por id/clave). Un audio desconocido cae al tono por defecto (nunca mudo).
  const audioActual =
    actual?.audio ??
    (secciones.find((s) => s.id === actual?.seccionId) ?? secciones.find((s) => s.clave === actual?.seccion))?.audio ??
    null;
  React.useEffect(() => {
    if (actual && alarma.armado.current) alarma.start(tonoDe(audioActual)); else alarma.stop();
  }, [actual, audioActual, alarma]);

  const personal = def?.personal ?? [];
  const estatusById = new Map((def?.estatus ?? []).map((e) => [e.personalId, e]));
  const contByPersona = new Map((def?.contadores ?? []).map((c) => [c.personalId, c]));

  async function aceptar(notifId: string, personalId: string) {
    try { await aceptarNotificacion(notifId, personalId, centro); refetch(); }
    catch (e) { toastError(e, tRoot); }
  }
  // Retirar un aviso atascado (el paciente se fue). Idempotente: no tratar como error si ya lo tomaron.
  async function cancelar(notifId: string) {
    try { await cancelarNotificacion(notifId, undefined, centro); refetch(); }
    catch (e) { toastError(e, tRoot); }
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground md:p-6">
      {/* Barra */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{tRoot(def?.panel.labelKey ?? "panel.enfermeria")}</h1>
          <span className={"inline-block size-2.5 rounded-full " + (live ? "bg-success-foreground" : "bg-muted-foreground/40")} title={live ? "live" : "off"} />
        </div>
        <div className="flex items-center gap-2">
          {!alarma.armado.current && (
            <button type="button" onClick={alarma.armar} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium" title={t("activarSonido")}>
              <HugeiconsIcon icon={VolumeHighIcon} className="size-4" /> {t("activarSonido")}
            </button>
          )}
        </div>
      </div>

      {/* Secciones + muro de tarjetas por enfermera */}
      {defRes.state.kind === "loading" && <p className="text-muted-foreground">…</p>}
      {def && secciones.length === 0 && <p className="text-muted-foreground">{t("sinSecciones")}</p>}
      <div className="space-y-5">
        {secciones.map((s) => (
          <section key={s.id}>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: s.color ?? undefined }} aria-hidden />
              <h2 className="text-lg font-semibold">{tRoot(s.labelKey)}</h2>
            </div>
            {s.visible ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {personal.map((p) => {
                  const cont = contByPersona.get(p.id);
                  const nSec = cont?.porSeccion?.[s.clave] ?? 0;
                  const est = estatusById.get(p.id);
                  const pc = colorForName(p.nombre);
                  const activo = nSec > 0;
                  const tint = tinteHex(s.color);
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-foreground/10 shadow-[0_1px_2px_rgba(16,32,64,0.04),0_8px_20px_-12px_rgba(16,32,64,0.15)] transition-shadow hover:shadow-[0_2px_6px_rgba(16,32,64,0.06),0_16px_32px_-12px_rgba(16,32,64,0.22)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {/* Punto de color por enfermera: identidad estable, discreta. */}
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: pc }} aria-hidden />
                          <span className="truncate text-[15px] font-semibold text-foreground">{p.nombre}</span>
                        </div>
                        <span
                          className={
                            "inline-grid h-7 min-w-[1.75rem] shrink-0 place-items-center rounded-full px-2 text-sm font-bold tabular-nums " +
                            (activo ? (tint ? "" : "bg-primary/10 text-primary") : "bg-muted text-muted-foreground")
                          }
                          style={activo && tint ? { backgroundColor: tint, color: s.color ?? undefined } : undefined}
                        >
                          {nSec}
                        </span>
                      </div>
                      {cont && Object.keys(cont.porSeccion || {}).length > 1 && (
                        <div className="flex flex-wrap gap-x-2.5 gap-y-1 border-t border-foreground/5 pt-2 text-[11px] text-muted-foreground">
                          {secciones.map((sx) => (
                            <span key={sx.clave} className="tabular-nums">
                              {tRoot(sx.labelKey)}{" "}
                              <span className="font-semibold text-foreground/70">{cont.porSeccion?.[sx.clave] ?? 0}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {est && (est.labelKey || est.label) && (
                        <span className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={est.color ? { backgroundColor: `${est.color}22`, color: est.color } : undefined}>
                          {est.labelKey && tRoot.has(est.labelKey) ? tRoot(est.labelKey) : est.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-3 w-full rounded" style={{ backgroundColor: s.color ?? undefined }} aria-hidden />
            )}
          </section>
        ))}
      </div>

      {/* Cola */}
      {pendientes.length > 1 && (
        <div className="fixed bottom-4 right-4 rounded-full bg-warning-foreground px-4 py-2 text-sm font-bold text-white shadow-lg">
          {t("enCola", { n: pendientes.length - 1 })}
        </div>
      )}

      {/* Aviso entrante a pantalla completa. La sección (color/nombre) se resuelve de la definición
          por seccionId; el nombre/récord del paciente y el servicio los enriquece el BE en el payload. */}
      {actual && (() => {
        const sec = secciones.find((s) => s.id === actual.seccionId) ?? secciones.find((s) => s.clave === actual.seccion);
        const color = actual.color ?? sec?.color ?? "#111827";
        const secLabel = sec ? tRoot(sec.labelKey) : (actual.seccion ?? "");
        return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6" style={{ backgroundColor: color + "F2" }}>
          <p className="text-2xl font-semibold uppercase tracking-wide text-white/90">{secLabel}</p>
          <h2 className="mt-2 text-center text-5xl font-black text-white md:text-6xl">{actual.pacienteNombre ?? "—"}</h2>
          {actual.record && <p className="mt-1 text-2xl font-bold text-white/90">{t("record")} {actual.record}</p>}
          {actual.servicioNombre && <p className="text-lg text-white/80">{actual.servicioNombre}</p>}
          <div className="mt-8 grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3">
            {personal.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!puedeAceptar}
                onClick={() => aceptar(actual.id, p.id)}
                className="min-h-[88px] rounded-2xl bg-white/95 p-4 text-xl font-bold text-neutral-900 shadow-lg transition-transform active:scale-95 disabled:opacity-60"
              >
                {p.nombre}
              </button>
            ))}
          </div>
          {!puedeAceptar && <p className="mt-4 text-sm text-white/80">{t("soloEnfermeria")}</p>}
          {puedeCancelar && (
            <button
              type="button"
              onClick={() => cancelar(actual.id)}
              className="mt-6 rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              {t("cancelarAviso")}
            </button>
          )}
        </div>
        );
      })()}
    </div>
  );
}
