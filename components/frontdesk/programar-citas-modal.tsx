"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  agendarMultiple,
  crearSesion,
  getDisponibilidadServicio,
  getAgendaPaciente,
  getAgendaHoras,
  type DisponibilidadServicio,
  type AgendaItem,
  type AgendaHora,
} from "@/lib/api/frontdesk";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { buscarPaciente, type PacienteBusqueda } from "@/lib/api/facturas";
import { formatFechaSolo } from "@/lib/format/fecha";
import { toastError } from "@/lib/api/errors";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, CheckmarkCircle02Icon, Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Suma días a un "YYYY-MM-DD" sin corrimiento de zona (parseo por partes, aritmética en UTC).
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Modal "Programar citas" (dominio AGENDAR, BE prod 2026-07-23). Dos disparadores (data-driven, no
// hardcode): el botón Citar y el `render.postAccion` de una columna del tablero (p. ej. al Asistir).
// Filas de servicio de `GET /servicios` (data-driven); fechas múltiples → agendar-multiple; una → crearSesion.
export function ProgramarCitasModal({
  open,
  onOpenChange,
  centro,
  pacienteId: pacienteIdProp,
  pacienteNombre: pacienteNombreProp,
  defaultServicioId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  centro?: string;
  pacienteId?: string; // si viene (p. ej. tras Asistir) no se pide buscar
  pacienteNombre?: string;
  defaultServicioId?: string;
  onDone?: () => void;
}) {
  const t = useTranslations("programarCitas");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  // Paciente: preseleccionado (desde el tablero) o buscado (desde Citar).
  const [sel, setSel] = React.useState<PacienteBusqueda | null>(null);
  const pacienteId = pacienteIdProp ?? sel?.id ?? "";
  const pacienteNombre = pacienteNombreProp ?? (sel ? `${sel.nombres ?? ""} ${sel.apellidos ?? ""}`.trim() : "");

  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(h);
  }, [q]);
  const term = debounced.trim();
  const busqRes = useResource<PacienteBusqueda[]>(
    () => (!pacienteIdProp && term.length >= 2 ? buscarPaciente(term, centro) : Promise.resolve([])),
    [pacienteIdProp, term, centro],
  );
  const resultados = busqRes.state.kind === "ok" ? busqRes.state.data : [];

  // Servicios (tabs data-driven).
  const servRes = useResource<Servicio[]>(() => (centro ? getServicios(centro) : Promise.resolve([])), [centro]);
  const servicios = React.useMemo(
    () =>
      (servRes.state.kind === "ok" ? servRes.state.data : [])
        .filter((s) => s.activo !== false)
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre)),
    [servRes.state],
  );
  const [servicioId, setServicioId] = React.useState(defaultServicioId ?? "");
  const servicioEff = servicios.some((s) => s.id === servicioId) ? servicioId : (defaultServicioId ?? servicios[0]?.id ?? "");
  const servicioClave = servicios.find((s) => s.id === servicioEff)?.clave ?? "";

  // Fechas a agendar (una cita por fecha).
  const [fechas, setFechas] = React.useState<string[]>([]);
  const [nuevaFecha, setNuevaFecha] = React.useState("");
  function addFecha() {
    const f = nuevaFecha.trim();
    if (!f || fechas.includes(f)) return;
    setFechas((xs) => [...xs, f].sort());
    setNuevaFecha("");
  }

  // Disponibilidad (X/Y) del paciente para el servicio — informativa, NO bloquea (BE avisa igual).
  // Atada a `key`: el setState va solo en el async (evita setState-en-efecto/renders en cascada).
  const dispKey = open && pacienteId && servicioEff ? `${pacienteId}|${servicioEff}|${centro ?? ""}` : "";
  const [dispData, setDispData] = React.useState<{ key: string; d: DisponibilidadServicio } | null>(null);
  React.useEffect(() => {
    if (!dispKey) return;
    let cancel = false;
    getDisponibilidadServicio(servicioEff, pacienteId, centro)
      .then((d) => !cancel && setDispData({ key: dispKey, d }))
      .catch(() => {});
    return () => { cancel = true; };
  }, [dispKey, servicioEff, pacienteId, centro]);
  const disp = dispData && dispData.key === dispKey ? dispData.d : null;

  // Agenda existente del paciente (coloreada por servicio) para VER lo ya agendado y no doblar. Rango
  // hoy → +90d. Mismo patrón por-key (setState solo en el async).
  const hoy = todayISO();
  const agKey = open && pacienteId ? `${pacienteId}|${centro ?? ""}` : "";
  const [agData, setAgData] = React.useState<{ key: string; items: AgendaItem[] } | null>(null);
  React.useEffect(() => {
    if (!agKey) return;
    let cancel = false;
    getAgendaPaciente(pacienteId, hoy, addDaysISO(hoy, 90), centro)
      .then((items) => !cancel && setAgData({ key: agKey, items }))
      .catch(() => {});
    return () => { cancel = true; };
  }, [agKey, pacienteId, hoy, centro]);
  const agenda = agData && agData.key === agKey ? agData.items : [];

  // Cupos por HORA del servicio en la fecha que se está por agregar (vista-día). Informativa: muestra
  // vacíos por hora para elegir un día con espacio. Data-driven (BE /frontdesk/agenda). Patrón por-key.
  const horaKey = open && servicioClave && nuevaFecha ? `${servicioClave}|${nuevaFecha}|${centro ?? ""}` : "";
  const [horaData, setHoraData] = React.useState<{ key: string; horas: AgendaHora[] } | null>(null);
  React.useEffect(() => {
    if (!horaKey) return;
    let cancel = false;
    getAgendaHoras(servicioClave, nuevaFecha, centro)
      .then((r) => !cancel && setHoraData({ key: horaKey, horas: r.horas ?? [] }))
      .catch(() => {});
    return () => { cancel = true; };
  }, [horaKey, servicioClave, nuevaFecha, centro]);
  const horas = horaData && horaData.key === horaKey ? horaData.horas : [];

  const [busy, setBusy] = React.useState(false);
  // Fechas EFECTIVAS: incluye la fecha del picker aunque el usuario no haya pulsado "Agregar fecha"
  // (evita la trampa de UX de un botón deshabilitado con una fecha ya elegida). "Agregar fecha" sigue
  // sirviendo para acumular VARIAS fechas.
  const fechasEff = React.useMemo(() => {
    const f = nuevaFecha.trim();
    return f && !fechas.includes(f) ? [...fechas, f].sort() : fechas;
  }, [fechas, nuevaFecha]);
  const puedeGuardar = !!pacienteId && !!servicioEff && fechasEff.length > 0 && !busy;

  async function guardar() {
    if (!puedeGuardar) return;
    setBusy(true);
    try {
      const { warnings } =
        fechasEff.length > 1
          ? await agendarMultiple({ pacienteId, servicioId: servicioEff, fechas: fechasEff }, centro)
          : await crearSesion({ pacienteId, servicioId: servicioEff, fecha: fechasEff[0] } as never, centro);
      toast.success(t("agendadoOk", { n: fechasEff.length }));
      mostrarAvisos(warnings, tRoot); // cupo excedido / sin cupo — no bloquea
      onOpenChange(false);
      setFechas([]);
      setNuevaFecha("");
      setSel(null);
      setQ("");
      onDone?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  const excede = disp != null && fechasEff.length > Number(disp.pendienteTotal ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{pacienteNombre || t("elegirPaciente")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Paciente: buscar solo si no vino preseleccionado */}
          {!pacienteIdProp && (
            sel ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{pacienteNombre}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[sel.record && `${t("recordLabel")} ${sel.record}`, sel.telefono ?? sel.whatsapp].filter(Boolean).join(" · ") || sel.docId}
                  </div>
                </div>
                <button type="button" onClick={() => setSel(null)} className="shrink-0 text-xs font-medium text-primary hover:underline">
                  {t("cambiar")}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 rounded-md border px-3">
                  <HugeiconsIcon icon={Search01Icon} className="size-4 opacity-60" />
                  <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("buscarPh")} className="border-0 px-0 shadow-none focus-visible:ring-0" />
                </div>
                {term.length >= 2 && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-md border">
                    {resultados.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("sinResultados")}</p>
                    ) : (
                      resultados.map((p) => (
                        <button key={p.id} type="button" onClick={() => { setSel(p); setQ(""); }} className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/50">
                          <span className="font-medium">{`${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() || "—"}</span>
                          {(p.record || p.telefono) && <span className="text-[11px] text-muted-foreground">{[p.record && `${t("recordLabel")} ${p.record}`, p.telefono].filter(Boolean).join(" · ")}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {/* Servicio */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("servicio")}</span>
            <Select value={servicioEff} onValueChange={setServicioId}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("elegirServicio")} /></SelectTrigger>
              <SelectContent>
                {servicios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-2">
                      {s.color && <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />}
                      {s.nombre}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {/* Fechas (una cita por fecha) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("fechas")}</span>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFecha(); } }}
                className="h-9 w-44"
              />
              <Button type="button" variant="outline" size="sm" className="gap-1" disabled={!nuevaFecha} onClick={addFecha}>
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
                {t("agregarFecha")}
              </Button>
            </div>
            {/* Cupos por hora del día elegido (vacíos por hora): ayuda a ver si hay espacio. Informativo. */}
            {nuevaFecha && horas.length > 0 && (
              <div className="mt-1 rounded-lg border bg-muted/20 p-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("cuposDia")}</p>
                <div className="flex flex-wrap gap-1">
                  {horas.map((h) => {
                    const lleno = h.vacios <= 0;
                    return (
                      <span
                        key={h.hora}
                        title={t("cupoTitle", { vacios: h.vacios, cupo: h.cupo })}
                        className={
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] tabular-nums " +
                          (lleno
                            ? "bg-destructive/10 text-destructive line-through"
                            : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400")
                        }
                      >
                        {h.hora}<span className="opacity-70">·{h.vacios}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {fechas.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {fechas.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                    {formatFechaSolo(f)}
                    <button type="button" onClick={() => setFechas((xs) => xs.filter((x) => x !== f))} aria-label={tc("remove")} className="text-muted-foreground hover:text-destructive">
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Agenda existente del paciente (próximas), coloreada por servicio — para no doblar citas */}
          {pacienteId && agenda.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-2.5">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("proximas")}</p>
              <div className="flex flex-wrap gap-1.5">
                {agenda.map((a, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tabular-nums"
                    style={a.color ? { backgroundColor: `${a.color}22`, color: a.color } : { backgroundColor: "var(--muted)" }}
                    title={a.servicioNombre ?? ""}
                  >
                    {formatFechaSolo(a.fecha)}{a.servicioNombre ? ` · ${a.servicioNombre}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Disponibilidad (informativa) */}
          {disp != null && (
            <div className={"rounded-lg px-3 py-2 text-sm " + (excede ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted/40 text-muted-foreground")}>
              {t("pendientes", { n: Number(disp.pendienteTotal ?? 0) })}
              {excede && <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-[10px]">{t("excede")}</Badge>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{tc("cancel")}</Button>
          <Button onClick={guardar} disabled={!puedeGuardar}>{busy ? t("agendando") : t("agendar")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
