"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sun01Icon, Moon02Icon, VolumeHighIcon, StethoscopeIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

import {
  getPanelDefinicion,
  getPanelNotificaciones,
  aceptarNotificacion,
  cancelarNotificacion,
  type PanelDefinicion,
  type PanelNotificacion,
  type PanelPersonal,
  type PanelEstatus,
} from "@/lib/api/paneles";
import { getNurseStatusTipos, setNurseStatus, type NurseStatusTipo } from "@/lib/api/frontdesk";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useCan } from "@/hooks/use-can";
import { colorForName } from "@/lib/frontdesk/color";

const CLAVE = "enfermeria";
const THEME_KEY = "cmr_panel_theme";

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

  const [dark, setDark] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  if (!restored && typeof window !== "undefined") { setRestored(true); setDark(window.localStorage.getItem(THEME_KEY) === "dark"); }
  const toggleTheme = () => setDark((d) => { const n = !d; if (typeof window !== "undefined") window.localStorage.setItem(THEME_KEY, n ? "dark" : "light"); return n; });

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
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-background p-4 text-foreground md:p-6">
        {/* Barra */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{tRoot(def?.panel.labelKey ?? "panel.enfermeria")}</h1>
            <span className={"inline-block size-2.5 rounded-full " + (live ? "bg-emerald-500" : "bg-muted-foreground/40")} title={live ? "live" : "off"} />
          </div>
          <div className="flex items-center gap-2">
            {!alarma.armado.current && (
              <button type="button" onClick={alarma.armar} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium" title={t("activarSonido")}>
                <HugeiconsIcon icon={VolumeHighIcon} className="size-4" /> {t("activarSonido")}
              </button>
            )}
            {/* Estatus de enfermera: botón con contador (cuántas tienen estatus ahora) + modal para poner/quitar. */}
            <NurseStatusPanelButton personal={personal} estatus={def?.estatus ?? []} centro={centro} onChanged={refetch} />
            <button type="button" onClick={toggleTheme} className="rounded-md border p-2" aria-label={t("tema")}>
              <HugeiconsIcon icon={dark ? Sun01Icon : Moon02Icon} className="size-4" />
            </button>
          </div>
        </div>

        {/* Secciones + muro de tarjetas por enfermera */}
        {defRes.state.kind === "loading" && <p className="text-muted-foreground">…</p>}
        {def && secciones.length === 0 && <p className="text-muted-foreground">{t("sinSecciones")}</p>}
        <div className="space-y-5">
          {secciones.map((s) => (
            <section key={s.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: s.color ?? undefined }} aria-hidden />
                <h2 className="text-lg font-semibold">{tRoot(s.labelKey)}</h2>
              </div>
              {s.visible ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {personal.map((p) => {
                    const cont = contByPersona.get(p.id);
                    const nSec = cont?.porSeccion?.[s.clave] ?? 0;
                    const est = estatusById.get(p.id);
                    const pc = colorForName(p.nombre);
                    return (
                      <div key={p.id} className="rounded-xl border p-3" style={{ borderLeftColor: pc, borderLeftWidth: 4 }}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-base font-semibold">{p.nombre}</span>
                          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-lg font-bold tabular-nums" style={{ color: s.color ?? undefined }}>{nSec}</span>
                        </div>
                        {cont && Object.keys(cont.porSeccion || {}).length > 1 && (
                          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                            {secciones.map((sx) => <span key={sx.clave}>{tRoot(sx.labelKey)} {cont.porSeccion?.[sx.clave] ?? 0}</span>)}
                          </div>
                        )}
                        {est && (est.labelKey || est.label) && (
                          <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium" style={est.color ? { backgroundColor: `${est.color}22`, color: est.color } : undefined}>
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
          <div className="fixed bottom-4 right-4 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-lg">
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
    </div>
  );
}

// Botón "Estatus de enfermera" con contador + modal (paridad CMR viejo). El contador = cuántas
// enfermeras tienen estatus AHORA (burbuja roja; sin nadie, sin burbuja). El modal: elegir enfermera,
// parrilla de estatus recorriendo el CATÁLOGO con su color (data-driven, nada escrito a mano),
// "Reset (disponible)" para quitar, y la lista de estatus actuales con una equis para quitar de un toque.
// Reusa las APIs del frontdesk (mismo estatus vivo, append-only). Handoff HANDOFF-estatus-de-enfermera.
function NurseStatusPanelButton({
  personal,
  estatus,
  centro,
  onChanged,
}: {
  personal: PanelPersonal[];
  estatus: PanelEstatus[];
  centro?: string;
  onChanged: () => void;
}) {
  const t = useTranslations("panel");
  const tRoot = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [tipos, setTipos] = React.useState<NurseStatusTipo[]>([]);
  const [sel, setSel] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    getNurseStatusTipos(centro).then(setTipos).catch(() => setTipos([]));
  }, [open, centro]);

  const nombreDe = (id: string) => personal.find((p) => p.id === id)?.nombre ?? id.slice(0, 8);
  // Con estatus AHORA = las entradas que traen un tipo/etiqueta (el BE ya da el estatus vivo del día).
  const conStatus = estatus.filter((e) => e.statusTipoId || e.labelKey || e.label);
  const count = conStatus.length;
  const tipoLabel = (x: NurseStatusTipo) => (tRoot.has(x.labelKey) ? tRoot(x.labelKey) : x.nombre);

  async function aplicar(personalId: string, statusTipoId: string | null) {
    if (!personalId) return;
    setBusy(true);
    try {
      await setNurseStatus({ personalId, statusTipoId: statusTipoId ?? undefined } as never, centro);
      onChanged();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative rounded-md border p-2"
        aria-label={t("estatus.titulo")}
        title={t("estatus.titulo")}
      >
        <HugeiconsIcon icon={StethoscopeIcon} className="size-4" />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border bg-background p-4 text-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("estatus.titulo")}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label={tRoot("common.remove")} className="rounded p-1 hover:bg-muted">
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </button>
            </div>

            {/* Elegir enfermera + parrilla de estatus del catálogo (color del catálogo). */}
            <select
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              className="mb-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("estatus.elegirEnfermera")}</option>
              {personal.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...tipos]
                .filter((x) => x.activo !== false)
                .sort((a, b) => a.orden - b.orden)
                .map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    disabled={!sel || busy}
                    onClick={() => aplicar(sel, x.id)}
                    className="rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                    style={x.color ? { borderColor: x.color, color: x.color } : undefined}
                  >
                    {tipoLabel(x)}
                  </button>
                ))}
            </div>
            <button
              type="button"
              disabled={!sel || busy}
              onClick={() => aplicar(sel, null)}
              className="mt-2 w-full rounded-md border px-2 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              {t("estatus.reset")}
            </button>

            {/* Estatus actuales, cada uno con su color y una equis para quitarlo de un toque. */}
            <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("estatus.actuales")}</p>
            {conStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("estatus.sin")}</p>
            ) : (
              <ul className="space-y-1">
                {conStatus.map((e) => (
                  <li key={e.personalId} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate">{nombreDe(e.personalId)}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={e.color ? { backgroundColor: `${e.color}22`, color: e.color } : undefined}
                      >
                        {e.labelKey && tRoot.has(e.labelKey) ? tRoot(e.labelKey) : e.label}
                      </span>
                      <button type="button" disabled={busy} onClick={() => aplicar(e.personalId, null)} aria-label={tRoot("common.remove")} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
