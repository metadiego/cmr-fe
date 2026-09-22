"use client";

import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Add01Icon, Settings02Icon } from "@hugeicons/core-free-icons";

import { getAgendaDia, type AgendaDia, type CentroDia, type ColumnaEfectiva, type TipoFranja } from "@/lib/api/agenda-dia";
import { useFranjaResaltada, AhoraBadge } from "@/components/agenda/franja-resaltada";
import { cn } from "@/lib/utils";
import { getActiveCentro } from "@/lib/tenant";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getTiposCita, type TipoCita, type EstadoCitaCatalogo } from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { getDefinicion, type TableroDefinicion, type Transicion } from "@/lib/api/tablero";
import { parseDayUTC } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { puedeVerTodosLosCentros } from "@/lib/centros-scope";
import { ALL_CENTERS as ALL } from "@/lib/agenda/initial-center";
import { useAgendaCenter } from "@/hooks/use-agenda-center";
import { useMe } from "@/hooks/use-me";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useCan } from "@/hooks/use-can";
import { Can } from "@/components/kit/can";
import { FranjaTipoSection, CeldaCita } from "@/components/agenda/franja-tipo-section";
import { tinteFila, esTipoNueva } from "@/lib/agenda/tinte-tipo";
import { Chip, Kpi } from "@/components/agenda/dia-kpi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CitaModal } from "@/components/agenda/cita-modal";
import { PageContainer, PageHeader } from "@/components/ui/page";

const VISTA_KEY = "cmr_agenda_vista"; // preferencia POR DISPOSITIVO (localStorage): "clasica" | "nueva"
type Vista = "clasica" | "nueva";

export function DiaView({ fecha }: { fecha: string }) {
  const t = useTranslations("agenda");
  const format = useFormatter();
  const tc = useTranslations("common");
  // Vista clásica (la de siempre, DEFAULT e intacta) vs nueva (beta, reordenamiento visual). El equipo
  // puede alternar y opinar antes de decidir; se recuerda por equipo. Idea: docs/plans/agenda-dia-vista-alternativa-opcional.md
  const [vista, setVista] = React.useState<Vista>("clasica");
  const [modal, setModal] = React.useState<
    { fecha: string; centroId?: string; hora?: string; tipoCitaId?: string } | null
  >(null);

  const [prevF, setPrevF] = React.useState(false);
  if (!prevF && typeof window !== "undefined") {
    setPrevF(true);
    const savedVista = window.localStorage.getItem(VISTA_KEY);
    if (savedVista === "nueva" || savedVista === "clasica") setVista(savedVista);
  }
  function pickVista(v: Vista) {
    setVista(v);
    if (typeof window !== "undefined") window.localStorage.setItem(VISTA_KEY, v);
  }
  const SheetView = vista === "nueva" ? CentroSheetV2 : CentroSheet;

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  // Vista combinada (todos los centros) = solo admin/master; el BE 409ea a un
  // no-admin sin centro activo.
  const meState = useMe();
  const puedeCombinado = puedeVerTodosLosCentros(
    meState.kind === "ok" ? meState.me : null,
  );
  const centrosListos = centrosRes.state.kind === "ok" && meState.kind !== "loading";
  const { center: centro, pick: pickCentro } = useAgendaCenter({
    centerIds: centros.map((c) => c.id),
    ready: centrosListos,
    canSeeAllCenters: puedeCombinado,
  });
  const medicosRes = useResource<Personal[]>(() => getMedicos());
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];
  // Call-center board definition: its own tablero (citas_cc) with just the CC
  // states (agendada/confirmada) + their transitions. The Estado column becomes
  // an inline selector driven by this — the FE invents no state list.
  const defRes = useResource<TableroDefinicion>(() => getDefinicion("citas_cc"));
  const def = defRes.state.kind === "ok" ? defRes.state.data : null;
  // Editable columns come from the tablero definition (data-driven), not code.
  // The estado column is handled by its own selector, so exclude it here.
  const editableClaves = new Set(
    (def?.columns ?? [])
      .filter((c) => c.editable && c.clave !== "estado_selector")
      .map((c) => c.clave),
  );

  // No center resolved → ask for nothing: from a non-admin, a request with no `X-Tenant-ID` is a 409.
  const emptyDay: AgendaDia = { date: fecha, columns: [], centers: [] };
  const { state, reload, refresh } = useResource<AgendaDia>(
    () =>
      centro === null
        ? Promise.resolve(emptyDay)
        : getAgendaDia(fecha, centro === ALL ? { combinado: true } : { centroId: centro }),
    [fecha, centro],
  );

  // Live: refetch (silently) whenever anyone changes a cita in this scope, so
  // every open window stays in sync. combined → null (all permitted centers).
  const { live, failure } = useCitaStream({
    centroId: centro === ALL ? null : centro,
    entidad: "cita",
    enabled: centro !== null,
    onInvalidate: refresh,
  });

  // App locale, not the browser's, and UTC-anchored so the weekday cannot slide a day.
  const dia = parseDayUTC(fecha);
  const fechaLabel = dia ? format.dateTime(dia, "dayWeekdayLong") : fecha;

  const data = state.kind === "ok" ? state.data : null;
  const centrosData = data?.centers ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={<span className="capitalize">{fechaLabel}</span>}
        actions={
          <>
            <Link
              href="/scheduling/appointments"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              {t("today")}
            </Link>
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-2 py-0.5 text-xs font-medium text-success-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-foreground opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-success-foreground" />
                </span>
                {t("dia.live")}
              </span>
            )}
            {/* Toggle de vista (por dispositivo). La clásica es el default e intacta. */}
            <div className="inline-flex rounded-md border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => pickVista("clasica")}
                className={
                  "rounded-md px-2.5 py-1 font-medium transition-colors " +
                  (vista === "clasica" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {t("dia.vistaClasica")}
              </button>
              <button
                type="button"
                onClick={() => pickVista("nueva")}
                className={
                  "rounded-md px-2.5 py-1 font-medium transition-colors " +
                  (vista === "nueva" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {t("dia.vistaNueva")}
              </button>
            </div>
            <Can permiso="citas.config">
              <Link
                href="/scheduling/slots"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <HugeiconsIcon icon={Settings02Icon} className="size-4" />
                {t("cupos.configure")}
              </Link>
            </Can>
            <Select value={centro ?? ""} onValueChange={pickCentro}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {puedeCombinado && (
                  <SelectItem value={ALL}>{t("dia.allCenters")}</SelectItem>
                )}
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* No center means no agenda to ask for and no stream to open: say so, instead of leaving an
          empty day that looks like a failure. `needsCenter` covers the BE refusing it anyway. */}
      {centrosListos && (centro === null || failure?.needsCenter) && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t("dia.pickCenter")}</p>
      )}
      {centro !== null && state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {data && centrosData.length > 1 ? (
        <Tabs defaultValue={centrosData.some((c) => c.clinicId === getActiveCentro()) ? (getActiveCentro() as string) : centrosData[0]?.clinicId}>
          <TabsList className="mb-3">
            {centrosData.map((c) => (
              <TabsTrigger key={c.clinicId} value={c.clinicId}>{c.name}</TabsTrigger>
            ))}
          </TabsList>
          {centrosData.map((c) => (
            <TabsContent key={c.clinicId} value={c.clinicId}>
              <SheetView
                centro={c}
                columnas={data.columns}
                estados={def?.statuses ?? []}
                transiciones={def?.transitions ?? []}
                editableClaves={editableClaves}
                onChanged={refresh}
                onAgendar={(hora, tipo) =>
                  setModal({ fecha, centroId: c.clinicId, hora: hora ?? undefined, tipoCitaId: tipo.appointmentTypeId })
                }
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : data && centrosData.length === 1 ? (
        <SheetView
          centro={centrosData[0]}
          columnas={data.columns}
          estados={def?.statuses ?? []}
          transiciones={def?.transitions ?? []}
          editableClaves={editableClaves}
          onChanged={refresh}
          onAgendar={(hora, tipo) =>
            setModal({ fecha, centroId: centrosData[0].clinicId, hora: hora ?? undefined, tipoCitaId: tipo.appointmentTypeId })
          }
        />
      ) : null}

      {modal && (
        <CitaModal
          open
          fecha={modal.fecha}
          centroId={modal.centroId}
          horaInicial={modal.hora}
          tipoCitaIdInicial={modal.tipoCitaId}
          tipos={tipos}
          medicos={medicos}
          onOpenChange={(o) => !o && setModal(null)}
          onSaved={reload}
        />
      )}
    </PageContainer>
  );
}

function CentroSheet({
  centro,
  columnas,
  estados,
  transiciones,
  editableClaves,
  onAgendar,
  onChanged,
}: {
  centro: CentroDia;
  columnas: ColumnaEfectiva[];
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  editableClaves: Set<string>;
  onAgendar: (hora: string | null, tipo: TipoFranja) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("agenda");
  const { can } = useCan();
  // Combined mode returns each center's columns concatenated → dedupe by clave.
  const seen = new Set<string>();
  const cols = columnas
    .filter((c) => (seen.has(c.clave) ? false : (seen.add(c.clave), true)))
    .filter((c) => !c.permiso || can(c.permiso));
  const r = centro.resumen;
  const festivos = centro.festivos ?? [];
  const bloqueado = centro.bloqueado ?? false;
  const horaResaltada = useFranjaResaltada(centro.franjas.map((f) => f.time));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-3 text-sm">
        <span className="font-semibold">{centro.name}</span>
        <span className="text-muted-foreground">
          {t("dia.summary", {
            total: r?.totalCitas ?? 0,
            atendidas: r?.atendidas ?? 0,
            noShow: r?.noShow ?? 0,
          })}
        </span>
        {festivos.map((f) => (
          <span
            key={f.date + f.name}
            className={
              f.blocksSchedule
                ? "rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                : "rounded bg-info px-2 py-0.5 text-xs text-info-foreground"
            }
          >
            {f.blocksSchedule ? "🚫" : "🎉"} {f.name}
            {f.blocksSchedule ? ` — ${t("dia.closed")}` : ""}
          </span>
        ))}
        {centro.notasDia.filter((n) => n.active).map((n) => (
          <span key={n.id} className="rounded bg-warning px-2 py-0.5 text-xs text-warning-foreground">
            📌 {n.content}
          </span>
        ))}
      </div>

      {bloqueado && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("dia.closedNotice")}
        </div>
      )}

      {centro.franjas.map((franja) =>
        franja.tipos.map((tipo) => {
          if (tipo.appointments.length === 0 && tipo.vacios === 0) return null;
          const key = `${franja.time ?? "sin"}-${tipo.appointmentTypeId}`;
          return (
            <FranjaTipoSection
              key={key}
              franja={franja}
              tipo={tipo}
              cols={cols}
              clinicId={centro.clinicId}
              estados={estados}
              transiciones={transiciones}
              editableClaves={editableClaves}
              onChanged={onChanged}
              onAgendar={onAgendar}
              esAhora={franja.time !== null && franja.time === horaResaltada}
            />
          );
        }),
      )}
    </div>
  );
}

// VISTA NUEVA (beta): mismos datos, columnas y acciones que la clásica, reordenados. KPIs en tarjetas +
// franja compacta de cupos por hora (reemplaza las ~20 tablas vacías) + UNA tabla de citas del día
// filtrable por tipo (chips; "sin hora" es un filtro más, no una sección aparte).
function CentroSheetV2({
  centro,
  columnas,
  estados,
  transiciones,
  editableClaves,
  onAgendar,
  onChanged,
}: {
  centro: CentroDia;
  columnas: ColumnaEfectiva[];
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  editableClaves: Set<string>;
  onAgendar: (hora: string | null, tipo: TipoFranja) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("agenda");
  const tRoot = useTranslations();
  const { can } = useCan();
  const [filtro, setFiltro] = React.useState<string>(""); // "" = todos | tipoCitaId | "__sinhora__"

  const seen = new Set<string>();
  const cols = columnas
    .filter((c) => (seen.has(c.clave) ? false : (seen.add(c.clave), true)))
    .filter((c) => !c.permiso || can(c.permiso));
  const r = centro.resumen;
  const franjas = centro.franjas ?? [];
  const festivos = centro.festivos ?? [];
  const bloqueado = centro.bloqueado ?? false;

  // Tipos únicos (para los chips) + cupos libres del día.
  const tiposMap = new Map<string, string>();
  let libres = 0;
  franjas.forEach((f) => f.tipos.forEach((tp) => { tiposMap.set(tp.appointmentTypeId, tp.tipoNombre); libres += tp.vacios; }));
  const tiposChips = [...tiposMap.entries()];

  // Aplanar TODAS las citas (con o sin hora) a una sola lista.
  const items = franjas.flatMap((f) =>
    f.tipos.flatMap((tp) =>
      tp.appointments.map((fila, idx) => ({
        fila,
        hora: f.time,
        tipoCitaId: tp.appointmentTypeId,
        tipoColor: tp.tipoColor,
        tipoClave: tp.tipoClave,
        tipoNombre: tp.tipoNombre,
        ordinal: `${idx + 1}/${tp.cupo}`, // posición en la hora sobre el cupo
      })),
    ),
  );
  const hayNoHora = items.some((i) => i.hora === null);
  const filtered = items.filter((i) =>
    !filtro ? true : filtro === "__sinhora__" ? i.hora === null : i.tipoCitaId === filtro,
  );
  const franjasHora = franjas.filter((f) => f.time !== null);
  const horaResaltada = useFranjaResaltada(franjasHora.map((f) => f.time));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label={t("dia.kpiCitas")} value={r?.totalCitas ?? 0} />
        <Kpi label={t("dia.kpiAtendidas")} value={r?.atendidas ?? 0} tono="ok" />
        <Kpi label={t("dia.kpiNoShow")} value={r?.noShow ?? 0} tono="warn" />
        <Kpi label={t("dia.kpiLibres")} value={libres} tono="muted" />
      </div>

      {(festivos.length > 0 || centro.notasDia.some((n) => n.active)) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {festivos.map((f) => (
            <span
              key={f.date + f.name}
              className={
                f.blocksSchedule
                  ? "rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                  : "rounded bg-info px-2 py-0.5 text-xs text-info-foreground"
              }
            >
              {f.blocksSchedule ? "🚫" : "🎉"} {f.name}{f.blocksSchedule ? ` — ${t("dia.closed")}` : ""}
            </span>
          ))}
          {centro.notasDia.filter((n) => n.active).map((n) => (
            <span key={n.id} className="rounded bg-warning px-2 py-0.5 text-xs text-warning-foreground">📌 {n.content}</span>
          ))}
        </div>
      )}

      {bloqueado && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("dia.closedNotice")}
        </div>
      )}

      {/* Franja compacta de cupos por hora (reemplaza las ~20 tablas vacías). */}
      {franjasHora.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {franjasHora.map((f) => {
            const conCitas = f.tipos.some((tp) => tp.appointments.length > 0);
            const esAhora = f.time === horaResaltada;
            return (
              <div
                key={f.time}
                className={cn(
                  "min-w-[9.5rem] shrink-0 rounded-md ring-1 shadow-sm shadow-[rgba(16,32,64,0.06)] p-2",
                  esAhora ? "ring-2 ring-primary bg-primary/10" : conCitas ? "ring-primary/40 bg-primary/5" : "ring-foreground/10 bg-card",
                )}
              >
                <div className="mb-1 flex items-center gap-1.5 font-mono text-xs font-semibold">
                  {f.time}
                  {esAhora && <AhoraBadge label={t("dia.now")} className="text-[9px]" />}
                </div>
                <div className="space-y-0.5">
                  {f.tipos.filter((tp) => tp.cupo > 0).map((tp) => (
                    <div key={tp.appointmentTypeId} className="flex items-center justify-between gap-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{tp.tipoNombre}</span>
                      <span className="tabular-nums">{tp.vacios}/{tp.cupo}</span>
                      <Can permiso="citas.create">
                        <button
                          type="button"
                          onClick={() => onAgendar(f.time, tp)}
                          disabled={tp.vacios <= 0}
                          className="text-primary hover:underline disabled:opacity-30"
                          aria-label={t("dia.book", { tipo: tp.tipoNombre, hora: f.time ?? "" })}
                        >
                          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                        </button>
                      </Can>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chips de tipo + "sin hora" como filtro (no sección aparte). */}
      <div className="flex flex-wrap gap-1.5">
        <Chip active={filtro === ""} onClick={() => setFiltro("")}>{t("dia.filterAll")} ({items.length})</Chip>
        {tiposChips.map(([id, nombre]) => (
          <Chip key={id} active={filtro === id} onClick={() => setFiltro(id)}>
            {nombre} ({items.filter((i) => i.tipoCitaId === id).length})
          </Chip>
        ))}
        {hayNoHora && (
          <Chip active={filtro === "__sinhora__"} onClick={() => setFiltro("__sinhora__")}>
            {t("dia.noTime")} ({items.filter((i) => i.hora === null).length})
          </Chip>
        )}
      </div>

      {/* UNA sola tabla de citas del día — MISMAS columnas y celdas que la clásica. */}
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {/* Ordinal 1/x (x = cupo de la hora). */}
              <th className="w-10 px-2 py-1.5 text-left font-medium" aria-hidden />
              {cols.map((col) => (
                <th key={col.clave} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                  {tRoot(col.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 1} className="px-3 py-6 text-center text-muted-foreground">{t("dia.sinCitas")}</td>
              </tr>
            ) : (
              filtered.map(({ fila, tipoColor, tipoClave, tipoNombre, ordinal }) => (
                // Solo las citas de PACIENTE NUEVO se tiñen (las que más importan). Ajuste del dueño.
                <tr
                  key={fila.id}
                  className="border-t"
                  style={{ backgroundColor: esTipoNueva(tipoClave, tipoNombre) ? tinteFila(tipoColor) : undefined }}
                >
                  <td className="px-2 py-1.5 text-[10px] tabular-nums text-muted-foreground">{ordinal}</td>
                  {cols.map((col) => (
                    <CeldaCita
                      key={col.clave}
                      col={col}
                      fila={fila}
                      clinicId={centro.clinicId}
                      estados={estados}
                      transiciones={transiciones}
                      editableClaves={editableClaves}
                      onChanged={onChanged}
                    />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

