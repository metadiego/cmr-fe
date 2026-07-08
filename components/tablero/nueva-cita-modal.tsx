"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";

import type { CitaFila } from "@/lib/api/agenda-dia";
import {
  createCita,
  getTiposCita,
  getVisitasRecientes,
  type TipoCita,
  type Cita,
} from "@/lib/api/citas";
import { getOpciones, ejecutarAccion, type Opcion } from "@/lib/api/tablero";
import { asignarRecord } from "@/lib/api/pacientes";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PrescripcionGrid } from "@/components/tablero/prescripcion-grid";

const NO_MEDICO = "__none__";

function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO(): string {
  return plusDaysISO(0);
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}
function fmtHora(v: unknown): string | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? null
    : new Intl.DateTimeFormat("es-PR", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Puerto_Rico" }).format(d);
}
function fmtFechaCorta(iso: string, locale: string): string {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-PR", { day: "numeric", month: "short", timeZone: "America/Puerto_Rico" }).format(d);
}

// Modal de AGENDAMIENTO tras marcar ASISTIDO (por `render.postAccion`, no hardcode).
// UI "ficha de atención": héroe con avatar + línea de tiempo de la visita recién
// completada + agenda rápida de la próxima. Prescripción es plug-and-play (catálogo
// 404 → oculta). Ver docs/specs/ap-board — handoff PR #35.
export function NuevaCitaModal({
  tablero,
  fila,
  centroId,
  render,
  onClose,
  onSaved,
}: {
  tablero: string;
  fila: CitaFila;
  centroId?: string;
  render?: Record<string, unknown> | null; // config por-tablero de la columna (postAccion, prescripcion…)
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("nuevaCita");
  const tRoot = useTranslations();
  const locale = useLocale();
  const { can } = useCan();

  // Módulo prescripción PLUGGED por config (por-tablero). Ausente = enchufado
  // (default true); admin lo apaga con render.prescripcion:false. Cero hardcode.
  const prescripcionEnabled = render?.prescripcion !== false;
  const prescripcionRequerida = render?.prescripcionRequerida !== false; // obligatoria por defecto cuando está plugged
  const [prescripcionOk, setPrescripcionOk] = React.useState(true);

  const pacienteId = String(fila.pacienteId ?? "");
  const paciente = String(fila.paciente ?? fila.pacienteNombre ?? "");

  const [tipos, setTipos] = React.useState<TipoCita[]>([]);
  const [medicos, setMedicos] = React.useState<Opcion[]>([]);
  const [recientes, setRecientes] = React.useState<Cita[]>([]);
  const [record, setRecord] = React.useState<string>(String(fila.record ?? ""));

  const [tipoId, setTipoId] = React.useState<string>("");
  const [medicoId, setMedicoId] = React.useState<string>(NO_MEDICO);
  const [fecha, setFecha] = React.useState<string>("");
  const [notas, setNotas] = React.useState<string>("");
  const [busy, setBusy] = React.useState<null | "save" | "open" | "exit" | "record">(null);

  // Catálogos data-driven (tipos + médicos por centro + historial). Cero hardcode.
  React.useEffect(() => {
    let active = true;
    getTiposCita()
      .then((ts) => {
        if (!active) return;
        setTipos(ts);
        const seg = ts.find((x) => x.clave === "seguimiento") ?? ts[0];
        if (seg) setTipoId(seg.id);
      })
      .catch(() => {});
    getOpciones(tablero, "medico", centroId)
      .then((o) => {
        if (!active) return;
        setMedicos(o);
        const cur = o.find((x) => x.label === String(fila.medico ?? ""));
        if (cur) setMedicoId(cur.value);
      })
      .catch(() => {});
    if (pacienteId) {
      getVisitasRecientes(pacienteId, centroId)
        .then((v) => active && setRecientes(Array.isArray(v) ? v : []))
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [tablero, centroId, fila.medico, pacienteId]);

  const canWrite = can("citas.create");

  const nombreTipo = React.useCallback(
    (id: string) => tipos.find((x) => x.id === id)?.nombre ?? "",
    [tipos],
  );
  const colorTipo = React.useCallback(
    (id: string) => tipos.find((x) => x.id === id)?.color ?? null,
    [tipos],
  );

  // Visitas anteriores a hoy, más recientes primero (máx 4). Contexto clínico.
  const historial = React.useMemo(() => {
    const hoy = todayISO();
    return [...recientes]
      .filter((c) => String(c.fecha) < hoy)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
      .slice(0, 4);
  }, [recientes]);

  // Línea de tiempo de la visita recién completada (dato: timestamps de la fila).
  const pasos: Array<{ key: "stepPresent" | "stepConsult" | "stepAttended"; at: unknown; current?: boolean }> = [
    { key: "stepPresent", at: fila.presente },
    { key: "stepConsult", at: fila.en_consulta },
    { key: "stepAttended", at: fila.asistido, current: true },
  ];

  const quicks: Array<{ key: "quick1w" | "quick2w" | "quick1m" | "quick3m"; days: number }> = [
    { key: "quick1w", days: 7 },
    { key: "quick2w", days: 14 },
    { key: "quick1m", days: 30 },
    { key: "quick3m", days: 90 },
  ];

  async function crear(tId: string, f: string) {
    if (!pacienteId || !tId || !f) return;
    await createCita(
      {
        pacienteId,
        tipoCitaId: tId,
        fecha: f,
        ...(medicoId !== NO_MEDICO ? { medicoId } : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      } as Parameters<typeof createCita>[0],
      centroId,
    );
    onSaved?.();
    onClose();
  }

  async function onGuardar() {
    setBusy("save");
    try {
      await crear(tipoId, fecha);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  // "Abierto" (seguimiento): próxima a +30 días, sin exigir fecha manual.
  async function onAbierto() {
    const seg = tipos.find((x) => x.clave === "seguimiento") ?? tipos.find((x) => x.id === tipoId);
    if (!seg) return;
    setBusy("open");
    try {
      await crear(seg.id, plusDaysISO(30));
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  // "ALTA": no agenda próxima cita, solo cierra (paciente atendido).
  function onAlta() {
    onSaved?.();
    onClose();
  }

  // "Salir": revierte ASISTIDO (vuelve a en_consulta) y cierra.
  async function onSalir() {
    setBusy("exit");
    try {
      await ejecutarAccion({ tablero, entidadId: fila.id, accion: "volver_en_consulta" }, centroId);
      onSaved?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
      onClose();
    }
  }

  async function onGenerarRecord() {
    if (!pacienteId) return;
    setBusy("record");
    try {
      const p = await asignarRecord(pacienteId, centroId);
      setRecord(String((p as { numeroHistoria?: unknown }).numeroHistoria ?? ""));
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = busy !== null;
  // Obligatoriedad de prescripción: bloquea finalizar si está plugged+requerida y no resuelta.
  const bloqueaPrescripcion = prescripcionEnabled && prescripcionRequerida && !prescripcionOk;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Héroe */}
        <div className="relative shrink-0 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent px-6 pt-6 pb-5">
          <div className="flex items-start gap-4 pr-8">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-base font-bold text-primary ring-2 ring-primary/25 ring-offset-2 ring-offset-background">
              {initials(paciente)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
                {t("eyebrow")}
              </span>
              <DialogTitle className="truncate text-xl leading-tight tracking-tight">
                {paciente || t("patient")}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">{t("subline")}</DialogDescription>
            </div>
            <div className="shrink-0">
              {record ? (
                <span className="rounded-lg bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums shadow-sm ring-1 ring-border">
                  #{record}
                </span>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={onGenerarRecord} disabled={anyBusy || !pacienteId}>
                  {t("generateRecord")}
                </Button>
              )}
            </div>
          </div>

          {/* Línea de tiempo de la visita */}
          <div className="mt-5 flex items-center">
            {pasos.map((p, i) => {
              const hora = fmtHora(p.at);
              const done = !!p.at || !!p.current;
              return (
                <React.Fragment key={p.key}>
                  {i > 0 && <span className={"mx-1.5 h-0.5 flex-1 rounded-full " + (done ? "bg-primary/60" : "bg-border")} aria-hidden />}
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={
                        "grid size-6 place-items-center rounded-full text-[10px] font-bold " +
                        (p.current
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : done
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground")
                      }
                    >
                      {p.current ? "●" : "✓"}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t(p.key)}</span>
                    <span className="font-mono text-[10px] tabular-nums text-foreground/70">{hora ?? (p.current ? t("now") : "—")}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Cuerpo (scrollable) */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {historial.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("recentVisits")}</span>
              <div className="flex flex-wrap gap-1.5">
                {historial.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                    <span className="size-2 rounded-full" style={{ backgroundColor: colorTipo(String(c.tipoCitaId)) ?? "var(--muted-foreground)" }} />
                    <span className="font-medium tabular-nums">{fmtFechaCorta(String(c.fecha), locale)}</span>
                    <span className="text-muted-foreground">{nombreTipo(String(c.tipoCitaId))}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Agenda rápida */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("whenBack")}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {quicks.map((q) => {
                const iso = plusDaysISO(q.days);
                const active = fecha === iso;
                return (
                  <button
                    key={q.key}
                    type="button"
                    onClick={() => setFecha(iso)}
                    aria-pressed={active}
                    className={
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                      (active ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground")
                    }
                  >
                    {t(q.key)}
                  </button>
                );
              })}
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-9 w-[9.5rem]"
                min={todayISO()}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("doctor")}</span>
              <Select value={medicoId} onValueChange={setMedicoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("noDoctor")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MEDICO}>{t("noDoctor")}</SelectItem>
                  {medicos.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("type")}</span>
              <div className="flex flex-wrap gap-1.5">
                {tipos.map((tp) => {
                  const active = tp.id === tipoId;
                  const c = tp.color ?? undefined;
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => setTipoId(tp.id)}
                      aria-pressed={active}
                      className={
                        "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors " +
                        (active ? "" : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground")
                      }
                      style={active && c ? { borderColor: c, color: c, backgroundColor: `${c}1a` } : undefined}
                    >
                      {tp.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("notes")}</span>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t("notesPlaceholder")} rows={2} />
          </label>

          {/* Prescripción: plugged por config (render.prescripcion) + auto-oculta si no hay catálogo. */}
          {prescripcionEnabled && fila.id && (
            <PrescripcionGrid citaId={fila.id} centroId={centroId} onValidity={setPrescripcionOk} />
          )}
        </div>

        {/* Pie */}
        <div className="shrink-0 flex flex-col gap-2 border-t bg-muted/30 px-6 py-4">
          {bloqueaPrescripcion && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{t("prescriptionRequired")}</p>
          )}
          <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onSalir} disabled={anyBusy}>
            {t("exit")}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {canWrite && (
              <Button type="button" variant="outline" onClick={onAbierto} disabled={anyBusy || tipos.length === 0 || bloqueaPrescripcion}>
                {t("open")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              onClick={onAlta}
              disabled={anyBusy || bloqueaPrescripcion}
            >
              {t("discharge")}
            </Button>
            {canWrite && (
              <Button type="button" onClick={onGuardar} disabled={anyBusy || !tipoId || !fecha || bloqueaPrescripcion}>
                {t("save")}
              </Button>
            )}
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
