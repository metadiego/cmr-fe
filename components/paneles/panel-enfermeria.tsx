"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

import {
  getPanelDefinicion,
  getPanelNotificaciones,
  getPanelNotificacionesAceptadas,
  aceptarNotificacion,
  cancelarNotificacion,
  guardarOrdenPersonal,
  type PanelDefinicion,
  type PanelNotificacion,
  type PanelPersonal,
} from "@/lib/api/paneles";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { fillableReportsFor } from "@/lib/panel/panel-formatos";
import { sheetPath } from "@/lib/format-sheet/sheet";
import { isTodayPR } from "@/lib/format/fecha";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useCan } from "@/hooks/use-can";
import { colorForName } from "@/lib/frontdesk/color";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingRegion } from "@/components/kit/skeletons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createNursingAlarm, type AlarmTone, type NursingAlarm } from "@/lib/panel/nursing-alarm";

const CLAVE = "enfermeria";

// Tone per SECTION: the logical name (`panel_secciones.audio`) decides how it sounds, so the nurse
// knows which one rang without looking. An unknown name is NEVER silent: it falls back to the default.
const TONO_DEFAULT: AlarmTone = { hz: 880, tipo: "sine" };
const TONOS: Record<string, AlarmTone> = {
  vitales: { hz: 880, tipo: "sine" },
  intravenoso: { hz: 587, tipo: "triangle" }, // lower and with another timbre
};
function tonoDe(audio?: string | null): AlarmTone {
  return (audio && TONOS[audio]) || TONO_DEFAULT;
}

// Tinte suave (~12% alfa) a partir de un color hex del BE; si no es hex de 6 dígitos, sin tinte.
function tinteHex(color?: string | null): string | undefined {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}1f` : undefined;
}

// Alarm ON by default (lib/panel/nursing-alarm.ts). If the browser keeps the sound blocked until a
// gesture, the FIRST touch/click/key anywhere on the page unlocks it. There is no sound button at all.
function useAlarma() {
  const ref = React.useRef<NursingAlarm | null>(null);
  React.useEffect(() => {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const alarm = createNursingAlarm({ createContext: () => new AC() });
    ref.current = alarm;
    const desbloquear = () => {
      void alarm.unlock().then(() => {
        if (!alarm.needsGesture()) quitar();
      });
    };
    const eventos = ["pointerdown", "keydown", "touchstart"] as const;
    const quitar = () => eventos.forEach((e) => document.removeEventListener(e, desbloquear, true));
    eventos.forEach((e) => document.addEventListener(e, desbloquear, true));
    return () => { quitar(); alarm.stop(); ref.current = null; };
  }, []);
  const start = React.useCallback((tono: AlarmTone) => ref.current?.start(tono), []);
  const stop = React.useCallback(() => ref.current?.stop(), []);
  return { start, stop };
}

export function PanelEnfermeria({ centro }: { centro?: string }) {
  const t = useTranslations("panel");
  const tRoot = useTranslations();
  const router = useRouter();
  const { can } = useCan();
  const puedeAceptar = can("panel.aceptar");
  const puedeCancelar = can("panel.notificar");
  const puedeOrdenar = can("panel.config");

  const defRes = useResource<PanelDefinicion>(() => getPanelDefinicion(CLAVE, centro), [centro]);
  const [notifs, setNotifs] = React.useState<PanelNotificacion[]>([]);
  // La hoja que la enfermera llena EN PANTALLA (Sí/No, notas, Guardar, Imprimir) es el mismo editor de
  // /forms/[slug]/[sessionId] — se navega ahí, nunca se duplica. El panel no trae servicioId todavía en
  // todos lados (BE #663 mergeando): fillableReportsFor cruza por id y cae al nombre de respaldo.
  const serviciosRes = useResource<Servicio[]>(() => getServicios(centro), [centro]);
  const servicios = React.useMemo(() => (serviciosRes.state.kind === "ok" ? serviciosRes.state.data : []), [serviciosRes.state]);
  // Avisos aceptados HOY (cmr-be #664, sin filtro de fecha propio aún → se filtra aquí por
  // `acceptedAt`): así «Formatos» sigue alcanzable tras cerrar el aviso a pantalla completa, y
  // sobrevive a un recargo de esta pantalla, no solo mientras dura la pestaña.
  const [aceptadosHoy, setAceptadosHoy] = React.useState<PanelNotificacion[]>([]);
  const refetchAceptados = React.useCallback(() => {
    getPanelNotificacionesAceptadas(CLAVE, centro)
      .then((list) => setAceptadosHoy(list.filter((n) => isTodayPR(n.acceptedAt))))
      .catch(() => {});
  }, [centro]);
  React.useEffect(() => { refetchAceptados(); }, [refetchAceptados]);
  const [eligiendoReport, setEligiendoReport] = React.useState<PanelNotificacion | null>(null);
  const abrirHoja = React.useCallback(
    (n: PanelNotificacion) => {
      if (!n.sessionId) return;
      const reports = fillableReportsFor(n, servicios);
      if (reports.length === 1) router.push(sheetPath(reports[0].id, n.sessionId));
      else if (reports.length > 1) setEligiendoReport(n);
    },
    [servicios, router],
  );
  const alarma = useAlarma();
  const { start: sonar, stop: callar } = alarma;

  // Los contadores del día YA vienen en la definición → sin llamada aparte (dedup). En cada evento
  // SSE se recarga la definición (trae contadores frescos) + las notificaciones pendientes.
  // Silent refresh: a live event must not drop the wall back to its skeleton.
  // Depends on the STABLE `refresh`, not on `defRes` (a new object every render): with `defRes` the
  // 30 s safety-net interval below was torn down and re-armed on every render and could never fire.
  const { refresh: refrescarDef } = defRes;
  const refetch = React.useCallback(() => {
    refrescarDef();
    getPanelNotificaciones(CLAVE, centro).then(setNotifs).catch(() => {});
    refetchAceptados();
  }, [refrescarDef, centro, refetchAceptados]);
  // Carga inicial (una vez montado, patrón sin setState-en-render).
  React.useEffect(() => {
    getPanelNotificaciones(CLAVE, centro).then(setNotifs).catch(() => {});
  }, [centro]);

  // With no center (still loading, or not chosen yet) the stream is not opened: the bus is
  // center-scoped and the BE refuses a connection with no `X-Tenant-ID`.
  // See docs/specs/be-sse-acotado-al-centro-handoff.md.
  const { live } = useCitaStream({
    centroId: centro ?? null,
    entidad: "panel_notificacion",
    enabled: !!centro,
    onInvalidate: refetch,
  });

  // Red de seguridad (owner, 14-nov-2026): el SSE solo avisa de "panel_notificacion" (aceptar/cancelar
  // una notificación) — un cambio de secciones o de orden del personal (configuración, otra pantalla)
  // no emite evento ninguno, así que un kiosco YA conectado se quedaba viejo hasta recargar a mano.
  // Mientras el BE no mande esos eventos también, se refresca sola cada 30s, sin tocar el esqueleto.
  React.useEffect(() => {
    if (!centro) return;
    const id = setInterval(refetch, 30_000);
    return () => clearInterval(id);
  }, [centro, refetch]);

  // Cola: la más antigua primero. La alarma suena mientras haya avisos pendientes.
  const pendientes = notifs;
  const actual = pendientes[0] ?? null;

  const def = defRes.state.kind === "ok" ? defRes.state.data : null;
  const secciones = (def?.sections ?? []).slice().sort((a, b) => a.orden - b.orden);
  // El sonido depende de la SECCIÓN del aviso actual: su `audio` (lo enriquece el BE en la notificación;
  // respaldo a la sección por id/clave). Un audio desconocido cae al tono por defecto (nunca mudo).
  const audioActual =
    actual?.audio ??
    (secciones.find((s) => s.id === actual?.sectionId) ?? secciones.find((s) => s.clave === actual?.seccion))?.audio ??
    null;
  React.useEffect(() => {
    if (actual) sonar(tonoDe(audioActual)); else callar();
  }, [actual, audioActual, sonar, callar]);

  // Orden de las tarjetas (cmr-be#549): optimista, con vuelta atrás si falla. Mientras `ordenLocal`
  // exista manda sobre `def.staff`; se descarta en cuanto llega una definición fresca (ya trae el
  // orden del BE, confirmado o el de un evento SSE concurrente).
  const [ordenLocal, setOrdenLocal] = React.useState<PanelPersonal[] | null>(null);
  // Ajuste en render (no efecto: evita el cascading-render que marca react-hooks/set-state-in-effect),
  // mismo patrón que `prevHoraKey` en cita-modal.tsx: una `def` nueva (fresca del BE o de un SSE) manda
  // sobre cualquier orden optimista a medio confirmar.
  const [prevDef, setPrevDef] = React.useState(def);
  if (def !== prevDef) { setPrevDef(def); setOrdenLocal(null); }
  const personal = ordenLocal ?? def?.staff ?? [];
  const estatusById = new Map((def?.statuses ?? []).map((e) => [e.staffId, e]));
  const contByPersona = new Map((def?.counters ?? []).map((c) => [c.staffId, c]));

  async function guardarOrden(arr: PanelPersonal[], antes: PanelPersonal[]) {
    setOrdenLocal(arr);
    try {
      const { staff, advertencias } = await guardarOrdenPersonal(
        CLAVE,
        arr.map((p, i) => ({ staffId: p.id, sortOrder: i })),
        centro,
      );
      setOrdenLocal(staff);
      const omitidos = advertencias.find((a) => a.code === "PANEL_STAFF_NOT_ELIGIBLE");
      if (omitidos) {
        const n = Array.isArray(omitidos.staffIds) ? omitidos.staffIds.length : 1;
        toast.warning(t("staffOrder.notEligible", { n }));
      }
    } catch (e) {
      setOrdenLocal(antes);
      toastError(e, tRoot);
    }
  }
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  function soltarEn(targetId: string) {
    setOverId(null);
    if (!dragId || dragId === targetId) return setDragId(null);
    const antes = personal;
    const arr = [...antes];
    const from = arr.findIndex((p) => p.id === dragId);
    const to = arr.findIndex((p) => p.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    void guardarOrden(arr, antes);
  }
  // Teclado/tablet: el DnD nativo no funciona en táctil — mueve una posición y guarda igual.
  function moverA(id: string, delta: -1 | 1) {
    const antes = personal;
    const arr = [...antes];
    const from = arr.findIndex((p) => p.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= arr.length) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    void guardarOrden(arr, antes);
  }

  async function aceptar(notifId: string, personalId: string) {
    try {
      const aceptado = await aceptarNotificacion(notifId, personalId, centro);
      refetch();
      setAceptadosHoy((prev) => [aceptado, ...prev.filter((n) => n.id !== aceptado.id)]);
      abrirHoja(aceptado);
    } catch (e) { toastError(e, tRoot); }
  }
  // Retirar un aviso atascado (el paciente se fue). Idempotente: no tratar como error si ya lo tomaron.
  async function cancelar(notifId: string) {
    try { await cancelarNotificacion(notifId, undefined, centro); refetch(); }
    catch (e) { toastError(e, tRoot); }
  }

  return (
    <PageContainer>
      <PageHeader title={tRoot(def?.panel.labelKey ?? "panel.enfermeria")} />

      {/* Toolbar: no filters on this kiosk; only the live status on the right. The sound has NO button: it is
          always on, and if the browser holds it until a gesture, the first touch anywhere unlocks it (owner, 14-nov). */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={"inline-block size-2.5 rounded-full " + (live ? "bg-success-foreground" : "bg-muted-foreground/40")} title={live ? "live" : "off"} />
        </div>
      </div>

      {/* Secciones + muro de tarjetas por enfermera */}
      {defRes.state.kind === "loading" && <PanelSkeleton />}
      {defRes.state.kind === "fail" && <p className="text-sm text-destructive">{defRes.state.message}</p>}
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
                {personal.map((p, i) => {
                  const cont = contByPersona.get(p.id);
                  const nSec = cont?.bySection?.[s.clave] ?? 0;
                  const est = estatusById.get(p.id);
                  const pc = colorForName(p.name);
                  const activo = nSec > 0;
                  const tint = tinteHex(s.color);
                  return (
                    <div
                      key={p.id}
                      draggable={puedeOrdenar}
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => { setDragId(null); setOverId(null); }}
                      onDragOver={(e) => { if (puedeOrdenar && dragId) { e.preventDefault(); setOverId(p.id); } }}
                      onDrop={() => soltarEn(p.id)}
                      className={
                        "flex flex-col gap-2 rounded-md bg-card px-4 py-3.5 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 " +
                        (puedeOrdenar ? "cursor-grab " : "") +
                        (overId === p.id && dragId ? "ring-2 ring-primary " : "") +
                        (dragId === p.id ? "opacity-50" : "")
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {/* Punto de color por enfermera: identidad estable, discreta. */}
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: pc }} aria-hidden />
                          <span className="truncate text-[15px] font-semibold text-foreground">{p.name}</span>
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
                      {cont && Object.keys(cont.bySection || {}).length > 1 && (
                        <div className="flex flex-wrap gap-x-2.5 gap-y-1 border-t border-foreground/5 pt-2 text-[11px] text-muted-foreground">
                          {secciones.map((sx) => (
                            <span key={sx.clave} className="tabular-nums">
                              {tRoot(sx.labelKey)}{" "}
                              <span className="font-semibold text-foreground/70">{cont.bySection?.[sx.clave] ?? 0}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {est && (est.labelKey || est.label) && (
                        <span className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={est.color ? { backgroundColor: `${est.color}22`, color: est.color } : undefined}>
                          {est.labelKey && tRoot.has(est.labelKey) ? tRoot(est.labelKey) : est.label}
                        </span>
                      )}
                      {puedeOrdenar && (
                        <div className="flex justify-end gap-1 border-t border-foreground/5 pt-1.5">
                          <button
                            type="button"
                            aria-label={t("staffOrder.up")}
                            disabled={i === 0}
                            onClick={() => moverA(p.id, -1)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          >
                            <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("staffOrder.down")}
                            disabled={i === personal.length - 1}
                            onClick={() => moverA(p.id, 1)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          >
                            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
                          </button>
                        </div>
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
        const sec = secciones.find((s) => s.id === actual.sectionId) ?? secciones.find((s) => s.clave === actual.seccion);
        const color = actual.color ?? sec?.color ?? "#111827";
        const secLabel = sec ? tRoot(sec.labelKey) : (actual.seccion ?? "");
        return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6" style={{ backgroundColor: color + "F2" }}>
          <p className="text-2xl font-semibold uppercase tracking-wide text-white/90">{secLabel}</p>
          <h2 className="mt-2 text-center text-5xl font-black text-white md:text-6xl">{actual.pacienteNombre ?? "—"}</h2>
          {actual.medicalRecordNumber && <p className="mt-1 text-2xl font-bold text-white/90">{t("record")} {actual.medicalRecordNumber}</p>}
          {actual.serviceName && <p className="text-lg text-white/80">{actual.serviceName}</p>}
          <div className="mt-8 grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3">
            {personal.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!puedeAceptar}
                onClick={() => aceptar(actual.id, p.id)}
                className="min-h-[88px] rounded-2xl bg-white/95 p-4 text-xl font-bold text-neutral-900 shadow-lg transition-transform active:scale-95 disabled:opacity-60"
              >
                {p.name}
              </button>
            ))}
          </div>
          {!puedeAceptar && <p className="mt-4 text-sm text-white/80">{t("soloEnfermeria")}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {fillableReportsFor(actual, servicios).length > 0 && (
              <button
                type="button"
                onClick={() => abrirHoja(actual)}
                className="rounded-lg bg-white/95 px-4 py-2 text-sm font-semibold text-neutral-900 shadow-lg transition-colors hover:bg-white"
              >
                {t("formatos")}
              </button>
            )}
            {puedeCancelar && (
              <button
                type="button"
                onClick={() => cancelar(actual.id)}
                className="rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                {t("cancelarAviso")}
              </button>
            )}
          </div>
        </div>
        );
      })()}

      {/* Visitas aceptadas hoy (en esta pantalla) con hoja llenable — para reabrirla sin ir al
          patient-desk si la enfermera cerró el aviso antes de guardar o quiere revisarla. */}
      {aceptadosHoy.filter((n) => fillableReportsFor(n, servicios).length > 0).length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("aceptadasHoy")}</h2>
          <div className="flex flex-wrap gap-2">
            {aceptadosHoy
              .filter((n) => fillableReportsFor(n, servicios).length > 0)
              .map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => abrirHoja(n)}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs hover:bg-muted"
                >
                  <span className="font-medium">{n.pacienteNombre ?? "—"}</span>
                  <span className="text-muted-foreground">· {n.serviceName ?? "—"}</span>
                  <span className="font-medium text-primary">{t("formatos")}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Más de una hoja llenable para el servicio: lista corta, luego se navega al editor elegido. */}
      <Dialog open={!!eligiendoReport} onOpenChange={(o) => !o && setEligiendoReport(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("elegirFormato")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {eligiendoReport &&
              fillableReportsFor(eligiendoReport, servicios).map((r) => (
                <Button
                  key={r.id}
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    router.push(sheetPath(r.id, eligiendoReport.sessionId!));
                    setEligiendoReport(null);
                  }}
                >
                  {r.labelKey && tRoot.has(r.labelKey) ? tRoot(r.labelKey) : (r.name ?? r.id)}
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// Loading wall: two sections (colour square + title) with the same staff-card grid and card box as the
// loaded panel (dot + name + count pill, status chip).
function PanelSkeleton() {
  return (
    <LoadingRegion className="space-y-5">
      {[0, 1].map((sec) => (
        <section key={sec}>
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="size-4 rounded" />
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md bg-card px-4 py-3.5 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Skeleton className="size-2.5 shrink-0 rounded-full" />
                    <Skeleton className={"h-4 " + ["w-24", "w-28", "w-20", "w-32", "w-24"][i]} />
                  </div>
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </LoadingRegion>
  );
}
