"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Add01Icon, Settings02Icon } from "@hugeicons/core-free-icons";

import { getAgendaDia, type AgendaDia, type CentroDia, type ColumnaEfectiva, type TipoFranja } from "@/lib/api/agenda-dia";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getTiposCita, type TipoCita, type EstadoCitaCatalogo } from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { getDefinicion, type TableroDefinicion, type Transicion } from "@/lib/api/tablero";
import { useResource } from "@/hooks/use-resource";
import { puedeVerTodosLosCentros } from "@/lib/centros-scope";
import { useMe } from "@/hooks/use-me";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useCan } from "@/hooks/use-can";
import { Can } from "@/components/kit/can";
import { EstadoSelect } from "@/components/tablero/estado-select";
import { CeldaEditable } from "@/components/tablero/celda-editable";
import { Cell } from "@/components/agenda/tablero-dinamico";
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

const ALL = "__all__";
const CENTRO_KEY = "cmr_agenda_centro";
const VISTA_KEY = "cmr_agenda_vista"; // preferencia POR DISPOSITIVO (localStorage): "clasica" | "nueva"
type Vista = "clasica" | "nueva";

export function DiaView({ fecha }: { fecha: string }) {
  const t = useTranslations("agenda");
  const tc = useTranslations("common");
  const [centro, setCentro] = React.useState<string>(ALL);
  // Vista clásica (la de siempre, DEFAULT e intacta) vs nueva (beta, reordenamiento visual). El equipo
  // puede alternar y opinar antes de decidir; se recuerda por equipo. Idea: docs/plans/agenda-dia-vista-alternativa-opcional.md
  const [vista, setVista] = React.useState<Vista>("clasica");
  const [modal, setModal] = React.useState<
    { fecha: string; centroId?: string; hora?: string; tipoCitaId?: string } | null
  >(null);

  // Restore persisted center + view choice once.
  const [prevF, setPrevF] = React.useState(false);
  if (!prevF && typeof window !== "undefined") {
    setPrevF(true);
    const saved = window.localStorage.getItem(CENTRO_KEY);
    if (saved) setCentro(saved);
    const savedVista = window.localStorage.getItem(VISTA_KEY);
    if (savedVista === "nueva" || savedVista === "clasica") setVista(savedVista);
  }
  function pickCentro(v: string) {
    setCentro(v);
    if (typeof window !== "undefined") window.localStorage.setItem(CENTRO_KEY, v);
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
    (def?.columnas ?? [])
      .filter((c) => c.editable && c.clave !== "estado_selector")
      .map((c) => c.clave),
  );

  const { state, reload, refresh } = useResource<AgendaDia>(
    () =>
      getAgendaDia(fecha, centro === ALL ? { combinado: true } : { centroId: centro }),
    [fecha, centro],
  );

  // Live: refetch (silently) whenever anyone changes a cita in this scope, so
  // every open window stays in sync. combined → null (all permitted centers).
  const { live } = useCitaStream({
    centroId: centro === ALL ? null : centro,
    entidad: "cita",
    onInvalidate: refresh,
  });

  const fechaLabel = new Date(fecha + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const data = state.kind === "ok" ? state.data : null;
  const centrosData = data?.centros ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={<span className="capitalize">{fechaLabel}</span>}
        actions={
          <>
            <Link
              href="/citas"
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
                href="/citas/agenda/cupos"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <HugeiconsIcon icon={Settings02Icon} className="size-4" />
                {t("cupos.configure")}
              </Link>
            </Can>
            <Select value={centro} onValueChange={pickCentro}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {puedeCombinado && (
                  <SelectItem value={ALL}>{t("dia.allCenters")}</SelectItem>
                )}
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {data && centrosData.length > 1 ? (
        <Tabs defaultValue={centrosData[0]?.clinicId}>
          <TabsList className="mb-3">
            {centrosData.map((c) => (
              <TabsTrigger key={c.clinicId} value={c.clinicId}>{c.nombre}</TabsTrigger>
            ))}
          </TabsList>
          {centrosData.map((c) => (
            <TabsContent key={c.clinicId} value={c.clinicId}>
              <SheetView
                centro={c}
                columnas={data.columnas}
                estados={def?.estados ?? []}
                transiciones={def?.transiciones ?? []}
                editableClaves={editableClaves}
                onChanged={refresh}
                onAgendar={(hora, tipo) =>
                  setModal({ fecha, centroId: c.clinicId, hora: hora ?? undefined, tipoCitaId: tipo.tipoCitaId })
                }
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : data && centrosData.length === 1 ? (
        <SheetView
          centro={centrosData[0]}
          columnas={data.columnas}
          estados={def?.estados ?? []}
          transiciones={def?.transiciones ?? []}
          editableClaves={editableClaves}
          onChanged={refresh}
          onAgendar={(hora, tipo) =>
            setModal({ fecha, centroId: centrosData[0].clinicId, hora: hora ?? undefined, tipoCitaId: tipo.tipoCitaId })
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
  const tRoot = useTranslations();
  const { can } = useCan();
  // Combined mode returns each center's columns concatenated → dedupe by clave.
  const seen = new Set<string>();
  const cols = columnas
    .filter((c) => (seen.has(c.clave) ? false : (seen.add(c.clave), true)))
    .filter((c) => !c.permiso || can(c.permiso));
  const r = centro.resumen;
  const festivos = centro.festivos ?? [];
  const bloqueado = centro.bloqueado ?? false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-3 text-sm">
        <span className="font-semibold">{centro.nombre}</span>
        <span className="text-muted-foreground">
          {t("dia.summary", {
            total: r?.totalCitas ?? 0,
            atendidas: r?.atendidas ?? 0,
            noShow: r?.noShow ?? 0,
          })}
        </span>
        {festivos.map((f) => (
          <span
            key={f.fecha + f.nombre}
            className={
              f.bloqueaAgenda
                ? "rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                : "rounded bg-info px-2 py-0.5 text-xs text-info-foreground"
            }
          >
            {f.bloqueaAgenda ? "🚫" : "🎉"} {f.nombre}
            {f.bloqueaAgenda ? ` — ${t("dia.closed")}` : ""}
          </span>
        ))}
        {centro.notasDia.filter((n) => n.activo).map((n) => (
          <span key={n.id} className="rounded bg-warning px-2 py-0.5 text-xs text-warning-foreground">
            📌 {n.contenido}
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
          if (tipo.citas.length === 0 && tipo.vacios === 0) return null;
          const key = `${franja.hora ?? "sin"}-${tipo.tipoCitaId}`;
          return (
            <section key={key} className="space-y-1">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <span className="font-mono">{franja.hora ?? t("dia.noTime")}</span>
                <span>{tipo.tipoNombre}</span>
                <span className="text-xs text-muted-foreground">
                  {tipo.citas.length}/{tipo.cupo}
                </span>
              </h3>
              <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      {cols.map((col) => (
                        <th key={col.clave} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                          {tRoot(col.labelKey)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tipo.citas.map((fila) => (
                      <tr key={fila.id} className="border-t">
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
                    ))}
                    {tipo.vacios > 0 && (
                      <tr className="border-t bg-muted/10">
                        <td colSpan={cols.length} className="px-3 py-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {t("dia.freeSlots", { n: tipo.vacios })}
                            </span>
                            <Can permiso="citas.create">
                              <button
                                type="button"
                                onClick={() => onAgendar(franja.hora, tipo)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                                {t("dia.book", { tipo: tipo.tipoNombre, hora: franja.hora ?? "" })}
                              </button>
                            </Can>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }),
      )}
    </div>
  );
}

// Celda de una cita: MISMA lógica que usa la vista clásica y la nueva (sin duplicar). Estado = selector
// inline; columnas editables = CeldaEditable; acción = reservado; resto = Cell de solo lectura.
function CeldaCita({
  col,
  fila,
  clinicId,
  estados,
  transiciones,
  editableClaves,
  onChanged,
}: {
  col: ColumnaEfectiva;
  fila: { id: string; estado?: string } & Record<string, unknown>;
  clinicId: string;
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  editableClaves: Set<string>;
  onChanged: () => void;
}) {
  const tRoot = useTranslations();
  return (
    <td className="px-3 py-1.5 whitespace-nowrap">
      {col.clave === "estado" ? (
        <EstadoSelect
          tablero="citas_cc"
          entidadId={fila.id}
          estado={String(fila.estado ?? fila["estado"] ?? "")}
          estados={estados}
          transiciones={transiciones}
          centroId={clinicId}
          onDone={onChanged}
        />
      ) : editableClaves.has(col.clave) ? (
        <CeldaEditable
          tablero="citas_cc"
          entidadId={fila.id}
          columna={col.clave}
          tipo={col.tipo}
          value={fila[col.clave]}
          centroId={clinicId}
          etiqueta={col.label ?? (tRoot.has(col.labelKey) ? tRoot(col.labelKey) : col.clave)}
          onChanged={onChanged}
        />
      ) : col.tipo === "accion" ? null : (
        <Cell col={col} value={fila[col.clave]} />
      )}
    </td>
  );
}

function Kpi({ label, value, tono }: { label: string; value: number; tono?: "ok" | "warn" | "muted" }) {
  const color =
    tono === "ok" ? "text-success-foreground"
    : tono === "warn" ? "text-warning-foreground"
    : tono === "muted" ? "text-muted-foreground"
    : "text-primary";
  return (
    <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] px-3 py-2">
      <div className={"text-xl font-bold tabular-nums " + color}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
        (active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/50")
      }
    >
      {children}
    </button>
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
  franjas.forEach((f) => f.tipos.forEach((tp) => { tiposMap.set(tp.tipoCitaId, tp.tipoNombre); libres += tp.vacios; }));
  const tiposChips = [...tiposMap.entries()];

  // Aplanar TODAS las citas (con o sin hora) a una sola lista.
  const items = franjas.flatMap((f) =>
    f.tipos.flatMap((tp) => tp.citas.map((fila) => ({ fila, hora: f.hora, tipoCitaId: tp.tipoCitaId }))),
  );
  const hayNoHora = items.some((i) => i.hora === null);
  const filtered = items.filter((i) =>
    !filtro ? true : filtro === "__sinhora__" ? i.hora === null : i.tipoCitaId === filtro,
  );
  const franjasHora = franjas.filter((f) => f.hora !== null);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label={t("dia.kpiCitas")} value={r?.totalCitas ?? 0} />
        <Kpi label={t("dia.kpiAtendidas")} value={r?.atendidas ?? 0} tono="ok" />
        <Kpi label={t("dia.kpiNoShow")} value={r?.noShow ?? 0} tono="warn" />
        <Kpi label={t("dia.kpiLibres")} value={libres} tono="muted" />
      </div>

      {(festivos.length > 0 || centro.notasDia.some((n) => n.activo)) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {festivos.map((f) => (
            <span
              key={f.fecha + f.nombre}
              className={
                f.bloqueaAgenda
                  ? "rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                  : "rounded bg-info px-2 py-0.5 text-xs text-info-foreground"
              }
            >
              {f.bloqueaAgenda ? "🚫" : "🎉"} {f.nombre}{f.bloqueaAgenda ? ` — ${t("dia.closed")}` : ""}
            </span>
          ))}
          {centro.notasDia.filter((n) => n.activo).map((n) => (
            <span key={n.id} className="rounded bg-warning px-2 py-0.5 text-xs text-warning-foreground">📌 {n.contenido}</span>
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
            const conCitas = f.tipos.some((tp) => tp.citas.length > 0);
            return (
              <div
                key={f.hora}
                className={"min-w-[9.5rem] shrink-0 rounded-md ring-1 shadow-sm shadow-[rgba(16,32,64,0.06)] p-2 " + (conCitas ? "ring-primary/40 bg-primary/5" : "ring-foreground/10 bg-card")}
              >
                <div className="mb-1 font-mono text-xs font-semibold">{f.hora}</div>
                <div className="space-y-0.5">
                  {f.tipos.filter((tp) => tp.cupo > 0).map((tp) => (
                    <div key={tp.tipoCitaId} className="flex items-center justify-between gap-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{tp.tipoNombre}</span>
                      <span className="tabular-nums">{tp.vacios}/{tp.cupo}</span>
                      <Can permiso="citas.create">
                        <button
                          type="button"
                          onClick={() => onAgendar(f.hora, tp)}
                          disabled={tp.vacios <= 0}
                          className="text-primary hover:underline disabled:opacity-30"
                          aria-label={t("dia.book", { tipo: tp.tipoNombre, hora: f.hora ?? "" })}
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
                <td colSpan={cols.length} className="px-3 py-6 text-center text-muted-foreground">{t("dia.sinCitas")}</td>
              </tr>
            ) : (
              filtered.map(({ fila }) => (
                <tr key={fila.id} className="border-t">
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

