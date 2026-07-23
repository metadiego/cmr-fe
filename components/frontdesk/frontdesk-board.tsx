"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";

import {
  getFrontdeskTablero,
  listSesionesRango,
  marcarTransicion,
  cancelarSesion,
  repararSesion,
  getDisponibilidadServicio,
  getHistorialPaciente,
  getNurseStatusTipos,
  getNurseStatusActuales,
  setNurseStatus,
  type HistorialSesion,
  type FrontdeskColumna,
  type FrontdeskFila,
  type FrontdeskTablero,
  type Sesion,
  type DisponibilidadServicio,
  type NurseStatusTipo,
  type NurseStatusActual,
} from "@/lib/api/frontdesk";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { getDefinicion, getOpciones, editarCelda, type TableroDefinicion, type Opcion } from "@/lib/api/tablero";
import { buscarPaciente } from "@/lib/api/facturas";
import { coincide } from "@/lib/frontdesk/search";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useCan } from "@/hooks/use-can";
import { useDictado } from "@/hooks/use-dictado";
import { toastError } from "@/lib/api/errors";
import { CentroPicker } from "@/components/facturacion/centro-picker";
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
import { formatFechaSolo } from "@/lib/format/fecha";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
  MicOff01Icon,
  Search01Icon,
  StethoscopeIcon,
  MoreHorizontalIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function fmtHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Sello de hora por estado del flujo — mapeo del contrato del BE (FrontdeskSesionEntity), único punto.
const STAMP_FIELD: Record<string, keyof Sesion> = {
  presente: "presenteEn",
  en_terapia: "terapiaInEn",
  asistido: "asistidoEn",
};

// ————————————————————————————————————————————————————————————————————————————
// Frontdesk del día (F4): tabs por servicio (data-driven /servicios) + KPIs-filtro + tabla dinámica
// (columnas del BE) con flujo Presente→En terapia→Asistido con sello de hora, búsqueda con dictado,
// disponibilidad por paciente, mediciones, SSE en vivo y reparación admin. docs/plans/fe-frontdesk-dia.md
// ————————————————————————————————————————————————————————————————————————————
export function FrontdeskBoard() {
  const t = useTranslations("frontdesk");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const { can } = useCan();
  const gate = useCentroGate();

  const [fecha, setFecha] = React.useState(todayISO());
  // Rango 2 fechas (PR #141) — SOLO gerente (RBAC cosmético; el BE es la autoridad). Vacío = un día.
  const [hasta, setHasta] = React.useState("");
  const puedeRango = can("frontdesk.rango");
  const rango = puedeRango && hasta && hasta > fecha ? { desde: fecha, hasta } : undefined;
  const [tab, setTab] = React.useState<string>("");
  const [estadoFiltro, setEstadoFiltro] = React.useState("");
  const [q, setQ] = React.useState("");

  // Catálogos data-driven: tabs de servicios + definición del vertical (estados con color, transiciones).
  // Los servicios son POR CENTRO (activo por centro) → refetch al cambiar el selector, en el acto.
  const servRes = useResource<Servicio[]>(
    () => (gate.centro ? getServicios(gate.centro) : Promise.resolve([])),
    [gate.centro],
  );
  // Self-heal de tabs: al volver a la pestaña del navegador (p. ej. después de crear un servicio en
  // Configuración) la lista se refresca sola — sin exigir recarga manual. Igual que el board con SSE.
  const refreshServicios = servRes.refresh;
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshServicios();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshServicios]);
  const servicios = React.useMemo(
    () =>
      (servRes.state.kind === "ok" ? servRes.state.data : [])
        .filter((s) => s.activo !== false)
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre)),
    [servRes.state],
  );
  const defRes = useResource<TableroDefinicion>(
    () => (gate.centro ? getDefinicion("servicios", gate.centro) : Promise.resolve({ estados: [], transiciones: [], columnas: [], subTipos: [] } as unknown as TableroDefinicion)),
    [gate.centro],
  );
  const def = defRes.state.kind === "ok" ? defRes.state.data : null;
  const estados = React.useMemo(() => def?.estados ?? [], [def]);
  const estadoDe = React.useCallback(
    (clave: string) => estados.find((e) => e.clave === clave),
    [estados],
  );
  // Pasos del flujo = estados (en su orden) que tienen transición homónima (presente/en_terapia/asistido).
  const flujo = React.useMemo(() => {
    const trans = new Set((def?.transiciones ?? []).map((x) => x.clave));
    return estados.filter((e) => trans.has(e.clave) && STAMP_FIELD[e.clave]);
  }, [def, estados]);

  // Tab efectivo derivado (primer servicio por defecto) — sin efecto, sin renders en cascada. Si el tab
  // elegido ya no existe en este centro (servicio apagado ahí), cae al primero disponible.
  const tabEfectivo = servicios.some((s) => s.clave === tab) ? tab : (servicios[0]?.clave ?? "");
  const servicioActivo = servicios.find((s) => s.clave === tabEfectivo);

  // Datos del día: proyección del tablero (columnas+filas del BE) + entidades de sesión (sellos de hora,
  // pacienteId, datos) unidas por id. El FE solo une; no recalcula.
  const boardRes = useResource<FrontdeskTablero>(
    () =>
      gate.centro && tabEfectivo
        ? getFrontdeskTablero(tabEfectivo, fecha, gate.centro, rango)
        : Promise.resolve({ columnas: [], filas: [] }),
    [gate.centro, tabEfectivo, fecha, rango?.hasta],
  );
  const sesRes = useResource<Sesion[]>(
    () =>
      gate.centro && servicioActivo
        ? listSesionesRango({ desde: fecha, hasta: rango?.hasta ?? fecha, servicioId: servicioActivo.id })
        : Promise.resolve([]),
    [gate.centro, servicioActivo?.id, fecha, rango?.hasta],
  );
  const board = boardRes.state.kind === "ok" ? boardRes.state.data : null;
  const sesiones = React.useMemo(
    () => new Map((sesRes.state.kind === "ok" ? sesRes.state.data : []).map((s) => [s.id, s])),
    [sesRes.state],
  );
  const refetch = React.useCallback(() => {
    boardRes.refresh();
    sesRes.refresh();
  }, [boardRes, sesRes]);

  // Superposición OPTIMISTA de celdas editadas (fila → columna → valor). El board del BE puede tardar
  // 1-3s en reflejar una edición (p.ej. asignar técnico) y un refetch en vivo (stream) traería el valor
  // aún vacío, "borrando" lo recién guardado. Mantenemos el valor editado hasta que el board coincida.
  const [overrides, setOverrides] = React.useState<Record<string, Record<string, string>>>({});
  const aplicarOverride = React.useCallback(
    (filaId: string, columna: string, valor: string) =>
      setOverrides((prev) => ({
        ...prev,
        [filaId]: { ...prev[filaId], [columna]: valor },
      })),
    [],
  );

  // En vivo (bus único /tablero/stream, entidad sesion). entrega_sin_saldo → alerta roja persistente.
  const [sinSaldoIds, setSinSaldoIds] = React.useState<Set<string>>(new Set());
  const { live } = useCitaStream({
    centroId: gate.centro ?? null,
    entidad: "sesion",
    enabled: !!gate.centro,
    onInvalidate: refetch,
    onEvent: (e) => {
      if (String(e.accion ?? "").includes("sin_saldo")) {
        setSinSaldoIds((prev) => new Set(prev).add(e.id));
        toast.error(t("entregaSinSaldo"));
      }
    },
  });

  // Búsqueda nombre/record/tel: nombre contra los textos de la fila; record/tel vía buscar-paciente
  // (server-side) → set de pacienteIds que se cruza con la sesión unida. Debounced.
  const [pacienteIds, setPacienteIds] = React.useState<Set<string> | null>(null);
  React.useEffect(() => {
    const query = q.trim();
    const centro = gate.centro;
    // Todo el setState va DENTRO del timeout (callback async) — nunca síncrono en el cuerpo del efecto.
    const h = setTimeout(() => {
      if (query.length < 2 || !centro) {
        setPacienteIds(null);
        return;
      }
      buscarPaciente(query, centro)
        .then((r) => setPacienteIds(new Set(r.map((p) => p.id))))
        .catch(() => setPacienteIds(null));
    }, 300);
    return () => clearTimeout(h);
  }, [q, gate.centro]);
  const dictado = useDictado(locale, (texto) => setQ(texto));

  // Toggles agrupados (render.group, p. ej. flujo_servicio) se COLAPSAN en UN solo "Flujo" en la posición
  // del grupo — paridad con Atención; nunca se pintan además como columnas sueltas (bug del doble pintado).
  const flujoCols = React.useMemo(
    () =>
      (board?.columnas ?? [])
        .filter((c) => c.tipo === "toggle" && (c.render as { group?: string } | null)?.group)
        .sort((a, b) => a.orden - b.orden),
    [board],
  );
  const columnas = React.useMemo(
    () =>
      (board?.columnas ?? [])
        .filter(
          (c) =>
            c.clave !== "fd_acciones" &&
            !(c.tipo === "toggle" && (c.render as { group?: string } | null)?.group),
        )
        .sort((a, b) => a.orden - b.orden),
    [board],
  );
  // Lista de render con el Flujo insertado donde estaba el grupo (o al final si no hay toggles agrupados).
  const colsRender = React.useMemo<({ kind: "col"; col: FrontdeskColumna } | { kind: "flujo" })[]>(() => {
    const out: ({ kind: "col"; col: FrontdeskColumna } | { kind: "flujo" })[] = [];
    let puesto = false;
    for (const c of (board?.columnas ?? []).slice().sort((a, b) => a.orden - b.orden)) {
      if (c.clave === "fd_acciones") continue;
      if (c.tipo === "toggle" && (c.render as { group?: string } | null)?.group) {
        if (!puesto) {
          out.push({ kind: "flujo" });
          puesto = true;
        }
        continue;
      }
      out.push({ kind: "col", col: c });
    }
    // Fallback (tableros SIN columnas toggle): flujo derivado de la definición. Si hay toggles —
    // agrupados o sueltos — el flujo ya vive en ellos y NO se agrega columna extra (evita doble pintado).
    const hayToggles = (board?.columnas ?? []).some((c) => c.tipo === "toggle");
    if (!puesto && !hayToggles) out.push({ kind: "flujo" });
    return out;
  }, [board]);

  // Opciones de las columnas `select` editables (p. ej. DOSIS = productos del grupo del servicio,
  // optionsSource productos_grupo PR #137). Tenant-scoped; el "tablero" de opciones = clave del servicio.
  const [optionsByCol, setOptionsByCol] = React.useState<Record<string, Opcion[]>>({});
  React.useEffect(() => {
    const selects = (board?.columnas ?? []).filter((c) => c.tipo === "select" && c.editable);
    if (!selects.length || !tabEfectivo || !gate.centro) return;
    let active = true;
    Promise.all(
      selects.map((c) =>
        getOpciones(tabEfectivo, c.clave, gate.centro)
          .then((ops) => [c.clave, ops] as const)
          .catch(() => [c.clave, []] as const),
      ),
    ).then((pairs) => {
      if (active) setOptionsByCol(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [board, tabEfectivo, gate.centro]);

  // Filtro compuesto: búsqueda (texto de fila O pacienteId) → luego KPI de estado.
  const visibles = React.useMemo(() => {
    // Aplica la superposición optimista: si el board aún no refleja un valor editado, se mantiene el
    // valor local (una vez que el board coincide, el spread es un no-op y queda consistente).
    const filas = (board?.filas ?? []).map((f) =>
      overrides[f.id] ? { ...f, ...overrides[f.id] } : f,
    );
    const conBusqueda = filas.filter((f) => {
      const textos = columnas.map((c) => (typeof f[c.clave] === "string" ? (f[c.clave] as string) : null));
      const porTexto = coincide(textos, q);
      const ses = sesiones.get(f.id);
      const porPaciente = !!pacienteIds && !!ses && pacienteIds.has(String(ses.pacienteId));
      return q.trim().length >= 2 ? porTexto || porPaciente : porTexto;
    });
    return estadoFiltro
      ? conBusqueda.filter((f) => String(f.fd_estado ?? "") === estadoFiltro)
      : conBusqueda;
  }, [board, overrides, columnas, q, pacienteIds, sesiones, estadoFiltro]);

  // KPIs sobre el set buscado (sin el filtro de estado, para que los conteos guíen).
  const kpis = React.useMemo(() => {
    const filas = board?.filas ?? [];
    const counts = new Map<string, number>();
    for (const f of filas) {
      const e = String(f.fd_estado ?? "");
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    return { counts, total: filas.length };
  }, [board]);

  const cargando = boardRes.state.kind === "loading" || defRes.state.kind === "loading";

  return (
    <div className="w-full px-6 py-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {t("live")}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <NurseStatusButton fecha={fecha} centro={gate.centro} />
          <Input
            type="date"
            className="h-9 w-40"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            aria-label={t("fecha")}
          />
          {puedeRango && (
            <Input
              type="date"
              className="h-9 w-40"
              value={hasta}
              min={fecha}
              onChange={(e) => setHasta(e.target.value)}
              aria-label={t("hasta")}
              title={t("rangoHint")}
            />
          )}
          {gate.puedeCambiar && gate.centro && (
            <Select value={gate.centro} onValueChange={gate.pick}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {gate.centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {can("citas.create") && (
            <Button size="sm" asChild>
              <Link href="/citas?tab=servicios">{t("citar")}</Link>
            </Button>
          )}
        </div>
      </div>

      {gate.cargando ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : gate.sinCentro ? (
        <p className="text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : gate.necesitaPicker ? (
        <div className="max-w-xl"><CentroPicker centros={gate.centros} onPick={gate.pick} /></div>
      ) : (
        <>
          {/* Tabs por servicio (color del dato) + "Todos" (GAP BE: vista por paciente) */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled
              title={t("todosTooltip")}
              className="cursor-not-allowed rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground opacity-60"
            >
              {t("todosTab")}
            </button>
            {servicios.map((s) => {
              const activo = s.clave === tabEfectivo;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setTab(s.clave); setEstadoFiltro(""); }}
                  className={
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (activo
                      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                      : "bg-background text-foreground hover:bg-muted")
                  }
                >
                  {s.color && (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden
                    />
                  )}
                  {s.nombre}
                </button>
              );
            })}
          </div>

          {/* Búsqueda con dictado */}
          <div className="mb-4 flex items-center gap-2">
            <div className="relative w-full max-w-md">
              <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("buscarPlaceholder")}
                className="h-9 pl-8 pr-9"
                aria-label={t("buscar")}
              />
              {dictado.soportado && (
                <button
                  type="button"
                  onClick={dictado.toggle}
                  aria-label={t("dictado")}
                  className={
                    "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors " +
                    (dictado.escuchando
                      ? "bg-destructive/15 text-destructive animate-pulse"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                >
                  <HugeiconsIcon icon={dictado.escuchando ? MicOff01Icon : Mic01Icon} className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* KPIs = filtros */}
          <div className="mb-4 flex flex-wrap gap-2">
            <KpiTile
              label={t("todos")}
              count={kpis.total}
              active={estadoFiltro === ""}
              onClick={() => setEstadoFiltro("")}
            />
            {estados
              .filter((e) => (kpis.counts.get(e.clave) ?? 0) > 0)
              .map((e) => (
                <KpiTile
                  key={e.clave}
                  label={tRoot(e.labelKey)}
                  count={kpis.counts.get(e.clave) ?? 0}
                  color={e.color}
                  active={estadoFiltro === e.clave}
                  onClick={() => setEstadoFiltro(estadoFiltro === e.clave ? "" : e.clave)}
                />
              ))}
          </div>

          {cargando && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
          {boardRes.state.kind === "fail" && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {boardRes.state.message}
            </p>
          )}

          {board && !cargando && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    {colsRender.map((item, i) =>
                      item.kind === "flujo" ? (
                        <th key={`flujo-${i}`} className="px-3 py-2 font-semibold">{t("flujo")}</th>
                      ) : (
                        <th key={item.col.clave} className="px-3 py-2 font-semibold">
                          {tRoot(((item.col.render as { labelKey?: string } | null)?.labelKey) ?? item.col.labelKey)}
                        </th>
                      ),
                    )}
                    <th className="px-3 py-2 text-right font-semibold">{tRoot("fd.col.acciones")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={colsRender.length + 1} className="px-3 py-10 text-center text-muted-foreground">
                        {t("sinFilas")}
                      </td>
                    </tr>
                  )}
                  {visibles.map((f) => (
                    <FilaSesion
                      key={f.id}
                      fila={f}
                      sesion={sesiones.get(f.id)}
                      colsRender={colsRender}
                      flujoCols={flujoCols}
                      flujo={flujo}
                      estadoDe={estadoDe}
                      servicio={servicioActivo}
                      tablero={tabEfectivo}
                      optionsByCol={optionsByCol}
                      centro={gate.centro}
                      sinSaldo={sinSaldoIds.has(f.id)}
                      canReparar={can("frontdesk.reparar")}
                      estados={estados.map((e) => ({ clave: e.clave, label: tRoot(e.labelKey) }))}
                      onChanged={refetch}
                      onOptimistic={(columna, valor) => aplicarOverride(f.id, columna, valor)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ————— KPI tile (stat-card filtro, casa: KPIs=filtros) —————
function KpiTile({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex min-w-24 flex-col items-start rounded-xl border px-3 py-2 text-left transition-all " +
        (active ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "hover:bg-muted/50")
      }
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
        {label}
      </span>
      <span className="text-xl font-bold tabular-nums">{count}</span>
    </button>
  );
}

// ————— Fila: celdas dinámicas + flujo con sello + acciones —————
function FilaSesion({
  fila,
  sesion,
  colsRender,
  flujoCols,
  flujo,
  estadoDe,
  servicio,
  tablero,
  optionsByCol,
  centro,
  sinSaldo,
  canReparar,
  estados,
  onChanged,
  onOptimistic,
}: {
  fila: FrontdeskFila;
  sesion?: Sesion;
  colsRender: ({ kind: "col"; col: FrontdeskColumna } | { kind: "flujo" })[];
  flujoCols: FrontdeskColumna[];
  flujo: { clave: string; labelKey: string; color?: string | null }[];
  estadoDe: (clave: string) => { labelKey: string; color?: string | null } | undefined;
  servicio?: Servicio;
  tablero: string;
  optionsByCol: Record<string, Opcion[]>;
  centro?: string;
  sinSaldo: boolean;
  canReparar: boolean;
  estados: { clave: string; label: string }[];
  onChanged: () => void;
  onOptimistic: (columna: string, valor: string) => void;
}) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);
  const [historialOpen, setHistorialOpen] = React.useState(false);
  const estadoActual = String(fila.fd_estado ?? sesion?.estado ?? "");
  const cancelada = estadoActual === "cancelada";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  function celda(c: FrontdeskColumna) {
    const v = fila[c.clave];
    if (c.clave === "fd_estado") {
      const e = estadoDe(String(v ?? ""));
      return (
        <span className="inline-flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="gap-1.5 font-medium"
            style={e?.color ? { backgroundColor: `${e.color}22`, color: e.color } : undefined}
          >
            {e ? tRoot(e.labelKey) : String(v ?? "—")}
          </Badge>
          {sinSaldo && <Badge variant="destructive" className="text-[10px]">{t("sinSaldo")}</Badge>}
        </span>
      );
    }
    if (c.clave === "fd_sesiones") {
      return (
        <SesionesCell
          display={v == null || v === "" ? "—" : String(v)}
          servicioId={servicio?.id}
          pacienteId={sesion?.pacienteId}
          centro={centro}
        />
      );
    }
    // Select editable (p. ej. DOSIS): opciones data-driven del grupo del servicio; escribe vía
    // editarCelda (writeBinding sesion.productoAplicadoId, evento auditable, PR #138).
    if (c.tipo === "select" && c.editable) {
      const ops = optionsByCol[c.clave] ?? [];
      const actual = v == null ? "" : String(v);
      const label = ops.find((o) => o.value === actual)?.label ?? (actual || undefined);
      return (
        <Select
          value={actual || undefined}
          disabled={busy || cancelada || ops.length === 0}
          onValueChange={(valor) => {
            onOptimistic(c.clave, valor); // pinta ya y NO se borra aunque el board tarde en reflejarlo
            run(() => editarCelda({ tablero, entidadId: fila.id, columna: c.clave, valor }, centro));
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-40">
            <SelectValue placeholder={ops.length ? t("elegir") : t("sinOpciones")}>{label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ops.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (c.tipo === "medicion" && c.render) {
      return (
        <MedicionCell
          col={c}
          sesion={sesion}
          disabled={busy || cancelada}
          onSave={(valor) => run(() => editarCelda({ tablero, entidadId: fila.id, columna: c.clave, valor }, centro))}
        />
      );
    }
    // Toggle SUELTO (sin group): badge HH:MM si está sellado; si no, botón que dispara su transición
    // (render.transition). Los agrupados no llegan aquí (colapsan en el Flujo).
    if (c.tipo === "toggle") {
      const r = (c.render ?? {}) as { transition?: string; labelKey?: string };
      const stamp = (v as string | null) ?? null;
      if (cancelada) return <span className="text-xs text-muted-foreground">—</span>;
      if (stamp) {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <HugeiconsIcon icon={Tick02Icon} className="size-3" />
            {fmtHora(stamp)}
          </span>
        );
      }
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="h-6 rounded-full px-2 text-[11px]"
          onClick={() =>
            run(() => marcarTransicion(fila.id, (r.transition ?? c.clave).replace(/_/g, "-") as never, {}, centro))
          }
        >
          {tRoot(r.labelKey ?? c.labelKey)}
        </Button>
      );
    }
    return <span>{v == null || v === "" ? "—" : String(v)}</span>;
  }

  // Pasos del flujo: PREFERIR los toggles agrupados del BE (render.group + transition + valor=sello en la
  // fila, PR paridad-Atención); fallback a estados∩transiciones + entidad unida (tableros sin toggles).
  const pasos = flujoCols.length
    ? flujoCols.map((c) => {
        const r = (c.render ?? {}) as { transition?: string; labelKey?: string };
        const trans = r.transition ?? c.clave;
        return {
          key: trans,
          labelKey: r.labelKey ?? c.labelKey,
          color: estadoDe(trans)?.color ?? null,
          stamp: (fila[c.clave] as string | null) ?? null,
        };
      })
    : flujo.map((p) => ({
        key: p.clave,
        labelKey: p.labelKey,
        color: p.color ?? null,
        stamp: sesion ? ((sesion[STAMP_FIELD[p.clave]] as string | null) ?? null) : null,
      }));

  const flujoCell = cancelada ? (
    <span className="text-xs text-muted-foreground">—</span>
  ) : (
    <div className="flex items-center gap-1">
      {pasos.map((paso, i) => {
        const hecho = !!paso.stamp;
        const previo = i === 0 || !!pasos[i - 1].stamp;
        const siguiente = !hecho && previo;
        return (
          <React.Fragment key={paso.key}>
            {i > 0 && <span className="h-px w-3 bg-border" aria-hidden />}
            {hecho ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={paso.color ? { backgroundColor: `${paso.color}22`, color: paso.color ?? undefined } : undefined}
                title={tRoot(paso.labelKey)}
              >
                <HugeiconsIcon icon={Tick02Icon} className="size-3" />
                {fmtHora(paso.stamp)}
              </span>
            ) : (
              <Button
                type="button"
                variant={siguiente ? "outline" : "ghost"}
                size="sm"
                disabled={!siguiente || busy}
                className={"h-6 rounded-full px-2 text-[11px] " + (!siguiente ? "opacity-40" : "")}
                onClick={() =>
                  run(() => marcarTransicion(fila.id, paso.key.replace(/_/g, "-") as never, {}, centro))
                }
              >
                {tRoot(paso.labelKey)}
              </Button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <tr className={"hover:bg-muted/30 " + (cancelada ? "opacity-50" : "")}>
      {colsRender.map((item, i) =>
        item.kind === "flujo" ? (
          <td key={`flujo-${i}`} className="px-3 py-2">{flujoCell}</td>
        ) : (
          <td key={item.col.clave} className="px-3 py-2">{celda(item.col)}</td>
        ),
      )}
      <td className="px-3 py-2 text-right">
        <RowMenu
          disabled={busy}
          cancelada={cancelada}
          canReparar={canReparar}
          estados={estados}
          conHistorial={!!sesion?.pacienteId}
          onHistorial={() => setHistorialOpen(true)}
          onCancelar={(motivo) => run(() => cancelarSesion(fila.id, motivo, centro))}
          onReparar={(payload) => run(() => repararSesion(fila.id, payload, centro))}
        />
        {sesion?.pacienteId && (
          <HistorialModal
            open={historialOpen}
            onOpenChange={setHistorialOpen}
            pacienteId={sesion.pacienteId}
            pacienteNombre={String(fila.paciente ?? "")}
            servicioId={servicio?.id}
            servicioNombre={servicio?.nombre}
            centro={centro}
          />
        )}
      </td>
    </tr>
  );
}

// ————— X/Y + disponibilidad del paciente (lazy, al abrir) —————
function SesionesCell({
  display,
  servicioId,
  pacienteId,
  centro,
}: {
  display: string;
  servicioId?: string;
  pacienteId?: string;
  centro?: string;
}) {
  const t = useTranslations("frontdesk");
  const [open, setOpen] = React.useState(false);
  const [disp, setDisp] = React.useState<DisponibilidadServicio | null>(null);
  const [fallo, setFallo] = React.useState(false);

  React.useEffect(() => {
    if (!open || disp || fallo || !servicioId || !pacienteId) return;
    getDisponibilidadServicio(servicioId, pacienteId, centro)
      .then(setDisp)
      .catch(() => setFallo(true));
  }, [open, disp, fallo, servicioId, pacienteId, centro]);

  if (!servicioId || !pacienteId) return <span className="tabular-nums">{display}</span>;
  const agotado = disp != null && Number(disp.pendienteTotal ?? 0) <= 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="cursor-pointer rounded px-1 tabular-nums underline decoration-dotted underline-offset-4 hover:bg-muted">
          {display}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("saldoTitle")}</p>
        {!disp && !fallo && <p className="text-sm text-muted-foreground">…</p>}
        {fallo && <p className="text-sm text-destructive">{t("saldoError")}</p>}
        {disp && (
          <div className="space-y-1.5">
            {(disp.paquetes ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("sinPaquetes")}</p>}
            {(disp.paquetes ?? []).map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{p.productoNombre ?? "—"}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {Number(p.entregadas ?? 0)}/{Number(p.total ?? 0)}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
              <span>{t("pendienteTotal")}</span>
              <span className={"tabular-nums " + (agotado ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                {Number(disp.pendienteTotal ?? 0)}
              </span>
            </div>
            {agotado && <Badge variant="destructive" className="mt-1">{t("sinSaldo")}</Badge>}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ————— Medición (PR #136/#138): input numérico con unidad; escribe vía editarCelda (BE valida rango) —————
function MedicionCell({
  col,
  sesion,
  disabled,
  onSave,
}: {
  col: FrontdeskColumna;
  sesion?: Sesion;
  disabled: boolean;
  onSave: (valor: number) => void;
}) {
  const tRoot = useTranslations();
  const r = (col.render ?? {}) as { dato?: string; unidadKey?: string; min?: number; max?: number; paso?: number };
  const dato = r.dato ?? col.clave;
  const actual = (sesion?.datos as Record<string, unknown> | null | undefined)?.[dato];
  const [val, setVal] = React.useState(actual != null ? String(actual) : "");

  const commit = () => {
    const n = Number(val);
    if (val === "" || Number.isNaN(n)) return;
    if (actual != null && Number(actual) === n) return;
    onSave(n);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="number"
        value={val}
        min={r.min}
        max={r.max}
        step={r.paso ?? 1}
        disabled={disabled}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        className="h-7 w-20 text-right tabular-nums"
        aria-label={tRoot(col.labelKey)}
      />
      {r.unidadKey && <span className="text-xs text-muted-foreground">{tRoot(r.unidadKey)}</span>}
    </span>
  );
}

// ————— Menú por fila: Cancelar + Reparar (RBAC admin) —————
function RowMenu({
  disabled,
  cancelada,
  canReparar,
  conHistorial,
  estados,
  onHistorial,
  onCancelar,
  onReparar,
}: {
  disabled: boolean;
  cancelada: boolean;
  canReparar: boolean;
  conHistorial: boolean;
  estados: { clave: string; label: string }[];
  onHistorial: () => void;
  onCancelar: (motivo: string) => void;
  onReparar: (payload: { motivo: string; estado?: string }) => void;
}) {
  const t = useTranslations("frontdesk");
  const tc = useTranslations("common");
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [repararOpen, setRepararOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [estadoNuevo, setEstadoNuevo] = React.useState("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" disabled={disabled} aria-label={t("acciones")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {conHistorial && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onHistorial(); }}>
              {t("historial")}
            </DropdownMenuItem>
          )}
          {!cancelada && (
            <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setMotivo(""); setCancelOpen(true); }}>
              {t("cancelar")}
            </DropdownMenuItem>
          )}
          {canReparar && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMotivo(""); setEstadoNuevo(""); setRepararOpen(true); }}>
              {t("reparar")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("cancelarTitle")}</DialogTitle></DialogHeader>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("motivo")} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>{tc("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={!motivo.trim()}
              onClick={() => { setCancelOpen(false); onCancelar(motivo.trim()); }}
            >
              {t("cancelar")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={repararOpen} onOpenChange={setRepararOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("repararTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("motivo")} autoFocus />
            <Select value={estadoNuevo} onValueChange={setEstadoNuevo}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("estadoNuevo")} /></SelectTrigger>
              <SelectContent>
                {estados.map((e) => <SelectItem key={e.clave} value={e.clave}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRepararOpen(false)}>{tc("cancel")}</Button>
            <Button
              disabled={!motivo.trim()}
              onClick={() => {
                setRepararOpen(false);
                onReparar({ motivo: motivo.trim(), ...(estadoNuevo ? { estado: estadoNuevo } : {}) });
              }}
            >
              {t("reparar")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ————— Estatus de enfermeras (triage/vitales) — ver + CAMBIAR (PR #141: SetNurseStatusDto) —————
function NurseStatusButton({ fecha, centro }: { fecha: string; centro?: string }) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [tipos, setTipos] = React.useState<NurseStatusTipo[] | null>(null);
  const [actuales, setActuales] = React.useState<NurseStatusActual[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [gen, setGen] = React.useState(0); // bump para recargar tras un set

  React.useEffect(() => {
    if (!open || !centro) return;
    getNurseStatusTipos(centro).then(setTipos).catch(() => setTipos([]));
    getNurseStatusActuales(fecha, centro).then(setActuales).catch(() => setActuales([]));
  }, [open, fecha, centro, gen]);

  const NONE = "__none__";
  async function cambiar(personalId: string, statusTipoId: string | null) {
    setBusy(true);
    try {
      await setNurseStatus({ personalId, statusTipoId: statusTipoId ?? undefined } as never, centro);
      setGen((g) => g + 1);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HugeiconsIcon icon={StethoscopeIcon} className="size-4" />
          {t("nurseTitle")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{t("nurseTitle")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {actuales == null && <p className="text-sm text-muted-foreground">…</p>}
          {actuales != null && actuales.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("nurseEmpty")}</p>
          )}
          {(actuales ?? []).map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="min-w-0 truncate font-medium">{a.personalNombre ?? a.personalId.slice(0, 8)}</span>
              <Select
                value={a.statusTipoId ?? NONE}
                disabled={busy}
                onValueChange={(v) => cambiar(a.personalId, v === NONE ? null : v)}
              >
                <SelectTrigger size="sm" className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("nurseSinStatus")}</SelectItem>
                  {(tipos ?? []).filter((x) => x.activo !== false).map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      <span className="inline-flex items-center gap-2">
                        {x.color && <span className="size-2 rounded-full" style={{ backgroundColor: x.color }} aria-hidden />}
                        {x.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ————— Modal "Historial de terapias" del paciente por servicio (BE PR #148, paridad legacy) —————
// Nivel mega-pro: tabla limpia con fecha, estado (badge), Sesión X/Y + Áreas, y staff. El BE lo proyecta
// todo (migradas viejas pueden traer X/Y y staff en null → se muestra "—"). Se abre desde el menú Acciones.
function HistorialModal({
  open,
  onOpenChange,
  pacienteId,
  pacienteNombre,
  servicioId,
  servicioNombre,
  centro,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pacienteId: string;
  pacienteNombre: string;
  servicioId?: string;
  servicioNombre?: string;
  centro?: string;
}) {
  const t = useTranslations("frontdesk");
  const tc = useTranslations("common");
  // Estado atado a la petición (key): evita setState síncrono en el efecto (solo se setea en el async).
  const key = open ? `${pacienteId}|${servicioId ?? ""}|${centro ?? ""}` : "";
  const [data, setData] = React.useState<{ key: string; rows: HistorialSesion[] } | null>(null);
  const [failKey, setFailKey] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let cancel = false;
    getHistorialPaciente(pacienteId, servicioId, centro)
      .then((r) => {
        if (!cancel) setData({ key, rows: r.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))) });
      })
      .catch(() => {
        if (!cancel) setFailKey(key);
      });
    return () => {
      cancel = true;
    };
  }, [open, pacienteId, servicioId, centro, key]);

  const rows = data && data.key === key ? data.rows : null;
  const fallo = failKey === key && key !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-muted/40 px-5 py-4">
          <DialogTitle>{t("histTitle")}</DialogTitle>
          <DialogDescription>
            {pacienteNombre}{servicioNombre ? ` · ${servicioNombre}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto">
          {rows == null && !fallo && <p className="px-5 py-10 text-center text-sm text-muted-foreground">{tc("loading")}</p>}
          {fallo && <p className="px-5 py-10 text-center text-sm text-destructive">{tc("error")}</p>}
          {rows != null && rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t("histEmpty")}</p>}
          {rows != null && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-semibold">{t("histFecha")}</th>
                  <th className="px-3 py-2 font-semibold">{t("histEstado")}</th>
                  <th className="px-3 py-2 font-semibold">{t("histDetalle")}</th>
                  <th className="px-5 py-2 font-semibold">{t("histStaff")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-5 py-2.5 tabular-nums">{formatFechaSolo(r.fecha) || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="secondary"
                        className={r.estado === "asistido" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : undefined}
                      >
                        {t.has(`histEstadoVal.${r.estado}`) ? t(`histEstadoVal.${r.estado}`) : (r.estado || "—")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{r.servicioNombre ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t("histSesion")}: {r.sesionNumero != null && r.sesionesTotales != null ? `${r.sesionNumero}/${r.sesionesTotales}` : "—"}
                        {r.areas != null ? ` · ${t("histAreas")}: ${r.areas}` : ""}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      {r.staffNombre ? (
                        <Badge variant="secondary" className="bg-sky-500/15 text-sky-700 dark:text-sky-300">{r.staffNombre}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
