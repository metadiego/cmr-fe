"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";

import {
  getFrontdeskTablero,
  listSesionesRango,
  getPendientesEntrega,
  getAgendaPaciente,
  type PendienteEntrega,
  type FrontdeskColumna,
  type FrontdeskFila,
  type FrontdeskTablero,
  type FrontdeskTotal,
  type Sesion,
  getAvisosFrontdesk,
  getPresentes,
  getFrontdeskTabs,
  type FrontdeskAvisosReporte,
  type PresentesResumen,
  type FrontdeskTab,
} from "@/lib/api/frontdesk";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { useFrontdeskTab } from "@/hooks/use-frontdesk-default-tab";
import { ServiciosTabs } from "@/components/frontdesk/servicios-tabs";
import { GenericBoard } from "@/components/tablero/generic-board";
import { HANDLERS_FE, todayISO, fmtHora, STAMP_FIELD } from "@/components/frontdesk/frontdesk-board.helpers";
import { FilaSesion } from "@/components/frontdesk/fila-sesion";
import { PRESENTES_DEFAULTS } from "@/lib/presentes-prefs";
import { getDefinicion, getOpciones, getTableros, type TableroDefinicion, type Opcion, type AccionTablero, type TableroRegistro } from "@/lib/api/tablero";
import { useRouter } from "next/navigation";
import { buscarPaciente, type PacienteBusqueda } from "@/lib/api/facturas";
import { coincide } from "@/lib/frontdesk/search";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useCan } from "@/hooks/use-can";
import { useDictado } from "@/hooks/use-dictado";
import { ProgramarCitasModal } from "@/components/frontdesk/programar-citas-modal";
import { FrontdeskSearchBar } from "@/components/frontdesk/frontdesk-search-bar";
import { UbicacionEnVivoWidget } from "@/components/frontdesk/ubicacion-en-vivo-widget";
import { FrontdeskToolbar } from "@/components/frontdesk/frontdesk-toolbar";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { PageContainer, PageHeader } from "@/components/ui/page";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, Alert02Icon } from "@hugeicons/core-free-icons";
import { LiveBadge } from "@/components/live-badge";

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
  const router = useRouter();

  // Acciones enchufables (hooks) del tablero servicios (data-driven, tableros.acciones). Se pintan en
  // el slot toolbar SOLO las de handler que el FE sabe ejecutar (HANDLERS_FE) → enchufar/quitar por dato.
  const regRes = useResource<TableroRegistro[]>(() => getTableros(), []);
  const acciones = React.useMemo(() => {
    const reg = (regRes.state.kind === "ok" ? regRes.state.data : []).find((r) => r.slug === "servicios");
    return (reg?.actions ?? [])
      .filter(
        (a) =>
          a.visible !== false &&
          (a.slot ?? "toolbar") === "toolbar" &&
          HANDLERS_FE.has(a.handler) &&
          (!a.requierePermiso || can(a.requierePermiso)),
      )
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }, [regRes.state, can]);
  function dispatchAccion(a: AccionTablero) {
    if (a.handler === "abrir_citas_servicio") {
      // Opens the Citas de Servicio tab (browse/create).
      router.push("/scheduling/appointments?tab=servicios");
    }
  }
  // Acción DEFAULT del FE: "Citas de servicio" siempre disponible en el riel aunque el BE aún no la
  // registre. Si el BE la declara en el registro, la suya manda (dedupe por handler).
  const accionesEfectivas = React.useMemo<AccionTablero[]>(() => {
    if (acciones.some((a) => a.handler === "abrir_citas_servicio")) return acciones;
    return [
      { clave: "citas_servicio", labelKey: "tb.acc.citas_servicio", icon: "calendar", slot: "toolbar", orden: 0, handler: "abrir_citas_servicio" },
      ...acciones,
    ];
  }, [acciones]);

  const [fecha, setFecha] = React.useState(todayISO());
  // Rango 2 fechas (PR #141) — SOLO gerente (RBAC cosmético; el BE es la autoridad). Vacío = un día.
  const [hasta, setHasta] = React.useState("");
  const puedeRango = can("frontdesk.rango");
  const rango = puedeRango && hasta && hasta > fecha ? { desde: fecha, hasta } : undefined;
  const [estadoFiltro, setEstadoFiltro] = React.useState("");
  // Ocultar canceladas: ENCENDIDO por defecto (la jornada se recarga y las anteriores quedan canceladas
  // como borrado lógico; no son bug, pero estorban el día). Filtro de cliente sobre estado==='cancelada'.
  // Se ignora cuando el usuario filtra explícitamente por el KPI "Cancelada" (quiere verlas para reactivar).
  const [ocultarCanceladas, setOcultarCanceladas] = React.useState(true);
  const [q, setQ] = React.useState("");
  // Modal "Programar citas": disparado por Citar (sin paciente) o por render.postAccion de una columna
  // del tablero (con paciente de la sesión). Data-driven, sin hardcode del estado que lo abre.
  const [programar, setProgramar] = React.useState<{ open: boolean; pacienteId?: string; pacienteNombre?: string; servicioId?: string }>({ open: false });

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
        .filter((s) => s.active !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [servRes.state],
  );
  // Pestañas del frontdesk (BE): las de servicio coinciden por slug con `servicios`; esta solo AÑADE la de
  // Consulta (boardSlug "atencion"), que monta el tablero de Atención que ya existe. Degrada a null si el
  // endpoint no responde → el frontdesk queda EXACTAMENTE como antes. Handoff consulta-como-pestana-del-frontdesk.
  const tabsRes = useResource<FrontdeskTab[]>(
    () => (gate.centro ? getFrontdeskTabs(gate.centro).catch(() => []) : Promise.resolve([])),
    [gate.centro],
  );
  const consultaTab = React.useMemo(
    () => (tabsRes.state.kind === "ok" ? tabsRes.state.data.find((tb) => tb.boardSlug === "atencion") ?? null : null),
    [tabsRes.state],
  );
  const [tab, setTab, consultaInitialEstado] = useFrontdeskTab(gate.centro, consultaTab); // handoff aterrizar-en-consulta
  const defRes = useResource<TableroDefinicion>(
    () => (gate.centro ? getDefinicion("servicios", gate.centro) : Promise.resolve({ statuses: [], transitions: [], columns: [], subtypes: [] } as unknown as TableroDefinicion)),
    [gate.centro],
  );
  const def = defRes.state.kind === "ok" ? defRes.state.data : null;
  const estados = React.useMemo(() => def?.statuses ?? [], [def]);
  const estadoDe = React.useCallback(
    (clave: string) => estados.find((e) => e.slug === clave),
    [estados],
  );
  // Pasos del flujo = estados (en su orden) que tienen transición homónima (presente/en_terapia/asistido).
  const flujo = React.useMemo(() => {
    const trans = new Set((def?.transitions ?? []).map((x) => x.slug));
    return estados.filter((e) => trans.has(e.slug) && STAMP_FIELD[e.slug]);
  }, [def, estados]);

  // La pestaña de Consulta está seleccionada (monta el tablero de Atención, no un servicio).
  const isConsulta = !!consultaTab && tab === consultaTab.slug;
  // Tab efectivo derivado (primer servicio por defecto) — sin efecto, sin renders en cascada. Si el tab
  // elegido ya no existe en este centro (servicio apagado ahí), cae al primero disponible. Consulta manda.
  const tabEfectivo = isConsulta ? consultaTab!.slug : servicios.some((s) => s.slug === tab) ? tab : (servicios[0]?.slug ?? "");
  const servicioActivo = isConsulta ? undefined : servicios.find((s) => s.slug === tabEfectivo);

  // ——— Filtro por PACIENTE (idea del dueño): al elegir un paciente, las pestañas quedan solo con SUS
  // servicios de ESTE día; un banner recuerda a quién se mira y un botón visible vuelve al día completo.
  // Sin endpoint nuevo: getAgendaPaciente(from=to=fecha) y se cruza por `serviceSlug`. Patrón por-key (el
  // setState va solo en el async). Handoff frontdesk-filtrar-por-paciente.
  const [pacienteFiltro, setPacienteFiltro] = React.useState<PacienteBusqueda | null>(null);
  const filtroKey = pacienteFiltro ? `${pacienteFiltro.id}|${fecha}|${gate.centro ?? ""}` : "";
  const [filtroData, setFiltroData] = React.useState<{ key: string; slugs: Set<string> } | null>(null);
  React.useEffect(() => {
    if (!filtroKey || !pacienteFiltro) return;
    let cancel = false;
    getAgendaPaciente(pacienteFiltro.id, fecha, fecha, gate.centro)
      .then((items) => !cancel && setFiltroData({ key: filtroKey, slugs: new Set(items.map((i) => i.serviceSlug).filter((x): x is string => !!x)) }))
      .catch(() => {});
    return () => { cancel = true; };
  }, [filtroKey, pacienteFiltro, fecha, gate.centro]);
  const filtroSlugs = filtroData && filtroData.key === filtroKey ? filtroData.slugs : null;
  const serviciosMostrados = filtroSlugs ? servicios.filter((s) => filtroSlugs.has(s.slug)) : servicios;
  // Al cargar el filtro, si la pestaña activa no es de este paciente, saltar a la primera visible.
  const [filtroAuto, setFiltroAuto] = React.useState("");
  if (filtroSlugs && filtroKey && filtroKey !== filtroAuto) {
    setFiltroAuto(filtroKey);
    if (!isConsulta && serviciosMostrados.length > 0 && !serviciosMostrados.some((s) => s.slug === tabEfectivo)) { // Consulta: el buscador filtra el propio tablero, no salta de pestaña
      setTab(serviciosMostrados[0].slug);
    }
  }
  const filtroPacienteNombre = pacienteFiltro
    ? pacienteFiltro.displayName || `${pacienteFiltro.firstName ?? ""} ${pacienteFiltro.lastName ?? ""}`.trim()
    : "";

  // Datos del día: proyección del tablero (columnas+filas del BE) + entidades de sesión (sellos de hora,
  // pacienteId, datos) unidas por id. El FE solo une; no recalcula.
  // En Consulta NO se pide el board de servicios (lo pinta GenericBoard "atencion"); así no se gasta ni
  // falla una llamada a un tablero de servicio con la clave "consulta".
  const boardRes = useResource<FrontdeskTablero>(
    () =>
      gate.centro && tabEfectivo && !isConsulta
        ? getFrontdeskTablero(tabEfectivo, fecha, gate.centro, rango)
        : Promise.resolve({ columns: [], rows: [] }),
    [gate.centro, tabEfectivo, fecha, rango?.hasta, isConsulta],
  );
  const sesRes = useResource<Sesion[]>(
    () =>
      gate.centro && servicioActivo
        ? listSesionesRango({ desde: fecha, hasta: rango?.hasta ?? fecha, servicioId: servicioActivo.id })
        : Promise.resolve([]),
    [gate.centro, servicioActivo?.id, fecha, rango?.hasta],
  );
  // Avisos / descuidos del día (§2): contador visible que abre la lista. Mismo permiso que la jornada
  // (frontdesk.read). Se recarga junto con el tablero, así al aplicar una dosis no comprada el número sube.
  const puedeAvisos = can("frontdesk.read");
  const avisosRes = useResource<FrontdeskAvisosReporte | null>(
    () =>
      gate.centro && puedeAvisos
        ? getAvisosFrontdesk(fecha, rango?.hasta ?? fecha, gate.centro)
        : Promise.resolve(null),
    [gate.centro, puedeAvisos, fecha, rango?.hasta],
  );
  const avisos = avisosRes.state.kind === "ok" ? avisosRes.state.data : null;
  const [avisosOpen, setAvisosOpen] = React.useState(false);

  // Contador de PRESENTES por servicio (la burbuja del legado). Del BE (no se cuenta en el FE): trae todos
  // los servicios del centro. Se refresca por el mismo SSE (ver refetch). Mientras el endpoint no exista,
  // getPresentes devuelve null y la barra no muestra contadores. Handoff presentes-por-servicio.
  const presentesRes = useResource<PresentesResumen | null>(
    () => (gate.centro ? getPresentes(gate.centro) : Promise.resolve(null)),
    [gate.centro, fecha],
  );
  // `present` = ahora mismo; `citasHoy` = agenda de hoy, dato correcto para si un tab muestra algo
  // (lib/api/frontdesk.ts; `present` NO sirve para eso).
  const [presentesPorClave, citasPorClave] = React.useMemo(() => {
    const p = new Map<string, number>(), c = new Map<string, number>();
    if (presentesRes.state.kind === "ok" && presentesRes.state.data) {
      for (const s of presentesRes.state.data.services) { p.set(s.slug, s.present); c.set(s.slug, s.citasHoy); }
    }
    return [p, c];
  }, [presentesRes.state]);
  const presentesMax = React.useMemo(() => {
    let mx = 1;
    for (const v of presentesPorClave.values()) mx = Math.max(mx, v);
    return mx;
  }, [presentesPorClave]);
  // Preferencias del indicador: por ahora los defaults (BE confirma el endpoint). Handoff presentes-por-servicio.
  const presentesPrefs = PRESENTES_DEFAULTS;
  // Ocultar tabs sin citas hoy (el seleccionado nunca se oculta); sin dato resuelto, TODOS visibles.
  // Handoff frontdesk-tabs-mayusculas-y-solo-actividad.
  const serviciosVisibles =
    presentesRes.state.kind === "ok" && presentesRes.state.data
      ? serviciosMostrados.filter((s) => s.slug === tabEfectivo || (citasPorClave.get(s.slug) ?? 0) > 0)
      : serviciosMostrados;
  const board = boardRes.state.kind === "ok" ? boardRes.state.data : null;
  const sesiones = React.useMemo(
    () => new Map((sesRes.state.kind === "ok" ? sesRes.state.data : []).map((s) => [s.id, s])),
    [sesRes.state],
  );
  const refetch = React.useCallback(() => {
    boardRes.refresh();
    sesRes.refresh();
    avisosRes.refresh();
    presentesRes.refresh(); // el conteo de presentes se recalcula al marcar presente / asistir (SSE)
  }, [boardRes, sesRes, avisosRes, presentesRes]);

  // En vivo (bus único /tablero/stream, entidad sesion). entrega_sin_saldo → alerta roja persistente.
  const [sinSaldoIds, setSinSaldoIds] = React.useState<Set<string>>(new Set());
  const { live } = useCitaStream({
    centroId: gate.centro ?? null,
    entidad: "sesion",
    enabled: !!gate.centro,
    onInvalidate: refetch,
    onEvent: (e) => {
      if (String(e.action ?? "").includes("sin_saldo")) {
        setSinSaldoIds((prev) => new Set(prev).add(e.id));
        toast.error(t("entregaSinSaldo"));
      }
    },
  });

  // Búsqueda ÚNICA nombre/record/tel (server-side, debounced): los OBJETOS alimentan el desplegable de
  // pacientes y el SET de ids filtra las filas. Antes había DOS cajas (ésta + un "filtrar por paciente"
  // aparte) que confundían: una sola las reemplaza. Elegir un paciente del desplegable filtra las
  // pestañas a SUS servicios del día (pacienteFiltro).
  const [qDeb, setQDeb] = React.useState("");
  React.useEffect(() => {
    const h = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(h);
  }, [q]);
  const busqPaciente = useResource<PacienteBusqueda[]>(
    () => (qDeb.trim().length >= 2 && gate.centro ? buscarPaciente(qDeb.trim(), gate.centro) : Promise.resolve([])),
    [qDeb, gate.centro],
  );
  const resultadosPaciente = busqPaciente.state.kind === "ok" ? busqPaciente.state.data : [];
  const pacienteIds = React.useMemo(
    () => (qDeb.trim().length >= 2 && busqPaciente.state.kind === "ok" ? new Set(busqPaciente.state.data.map((p) => p.id)) : null),
    [qDeb, busqPaciente.state],
  );
  const dictado = useDictado(locale, (texto) => setQ(texto));

  // Toggles agrupados (render.group, p. ej. flujo_servicio) se COLAPSAN en UN solo "Flujo" en la posición
  // del grupo — paridad con Atención; nunca se pintan además como columnas sueltas (bug del doble pintado).
  const flujoCols = React.useMemo(
    () =>
      (board?.columns ?? [])
        .filter((c) => c.tipo === "toggle" && (c.render as { group?: string } | null)?.group)
        .sort((a, b) => a.orden - b.orden),
    [board],
  );
  const columnas = React.useMemo(
    () =>
      (board?.columns ?? [])
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
    for (const c of (board?.columns ?? []).slice().sort((a, b) => a.orden - b.orden)) {
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
    const hayToggles = (board?.columns ?? []).some((c) => c.tipo === "toggle");
    if (!puesto && !hayToggles) out.push({ kind: "flujo" });
    return out;
  }, [board]);

  // Opciones de las columnas `select` editables (p. ej. DOSIS = productos del grupo del servicio,
  // optionsSource productos_grupo PR #137). Tenant-scoped; el "tablero" de opciones = clave del servicio.
  const [optionsByCol, setOptionsByCol] = React.useState<Record<string, Opcion[]>>({});
  React.useEffect(() => {
    // Columnas con opciones: selects editables + inputs con datalist (texto editable con optionsSource,
    // p. ej. fd_protocolo). Ambos consumen GET /tablero/opciones.
    const selects = (board?.columns ?? []).filter(
      (c) => c.editable && (c.tipo === "select" || !!(c.render as { optionsSource?: string } | null)?.optionsSource),
    );
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
    // Deps SIN tabEfectivo a propósito: al cambiar de pestaña, `board` se recarga (nueva ref) y el efecto
    // corre con el board FRESCO + la pestaña ya actualizada. Incluir tabEfectivo disparaba una corrida con
    // el board VIEJO (láser tiene fd_tecnico) contra la pestaña nueva (vitc sin fd_tecnico) → 404 espurio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, gate.centro]);

  // Saldo de dosis por paciente (para enriquecer el select de DOSIS): cuántas sesiones le quedan de cada
  // dosis que compró. Solo se pide si el tablero TIENE una columna de dosis (optionsSource productos_grupo);
  // se pide por paciente (endpoint 1-a-1) para los pacientes visibles con sesión y se REFRESCA cuando el
  // board se recarga (asistir consume una) o cambia la fecha — ambas cambian la ref de `board`/`sesiones`.
  const hayDosis = React.useMemo(
    () =>
      (board?.columns ?? []).some(
        (c) => (c.render as { optionsSource?: string } | null)?.optionsSource === "productos_grupo",
      ),
    [board],
  );
  const [saldoByPaciente, setSaldoByPaciente] = React.useState<Record<string, PendienteEntrega[]>>({});
  React.useEffect(() => {
    const centro = gate.centro;
    if (!centro) return;
    // Sin columna de dosis → ids vacío → el .then limpia el mapa (async, nunca setState síncrono en efecto).
    const ids = hayDosis
      ? Array.from(
          new Set(
            (board?.rows ?? [])
              .map((f) => sesiones.get(f.id)?.patientId)
              .filter((x): x is string => !!x),
          ),
        )
      : [];
    let active = true;
    Promise.all(
      ids.map((id) =>
        getPendientesEntrega(id, centro)
          .then((r) => [id, r] as const)
          .catch(() => [id, [] as PendienteEntrega[]] as const),
      ),
    ).then((pairs) => {
      if (active) setSaldoByPaciente(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [hayDosis, gate.centro, board, sesiones]);

  // Estado de una fila: PREFERIR el `estado` top-level que ahora manda el BE en cada fila (PR #195, la
  // verdad del flujo), con respaldo a la columna proyectada `fd_estado` y a la entidad de sesión.
  const estadoFila = React.useCallback(
    (f: FrontdeskFila) => String(f.estado ?? f.fd_estado ?? sesiones.get(f.id)?.status ?? ""),
    [sesiones],
  );

  // Filtro compuesto: paciente FIJADO (desplegable) filtra las filas de TODOS los servicios a ese paciente; si no, búsqueda (texto O pacienteId) → ocultar canceladas → KPI.
  const pacienteFiltroId = pacienteFiltro?.id ?? null;
  const visibles = React.useMemo(() => {
    const filas = board?.rows ?? [];
    const conBusqueda = filas.filter((f) => {
      const ses = sesiones.get(f.id);
      if (pacienteFiltroId) return !!ses && String(ses.patientId) === pacienteFiltroId;
      const textos = columnas.map((c) => (typeof f[c.clave] === "string" ? (f[c.clave] as string) : null));
      const textosConPaciente = ses?.patient ? [...textos, ses.patient.medicalRecordNumber, ses.patient.name] : textos;
      const porPaciente = !!pacienteIds && !!ses && pacienteIds.has(String(ses.patientId));
      return q.trim().length >= 2 ? coincide(textosConPaciente, q) || porPaciente : coincide(textosConPaciente, q);
    });
    const conVisibilidad =
      ocultarCanceladas && estadoFiltro !== "cancelada"
        ? conBusqueda.filter((f) => estadoFila(f) !== "cancelada")
        : conBusqueda;
    return estadoFiltro
      ? conVisibilidad.filter((f) => estadoFila(f) === estadoFiltro)
      : conVisibilidad;
  }, [board, columnas, q, pacienteFiltroId, pacienteIds, sesiones, estadoFiltro, ocultarCanceladas, estadoFila]);

  // Orden del board. Natural (sort=null): por PRESENTE (hora de llegada) asc = orden de TURNO; los que
  // aún no están presentes van al final. Clic en un encabezado ordena por esa columna (asc/desc). Clic en
  // el encabezado del Flujo vuelve al orden natural. Todo del lado del cliente sobre la página cargada.
  const [sort, setSort] = React.useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const ordenadas = React.useMemo(() => {
    const arr = [...visibles];
    if (!sort) {
      arr.sort((a, b) => {
        const pa = a["presente"] as string | undefined, pb = b["presente"] as string | undefined;
        if (pa && pb) return String(pa).localeCompare(String(pb));
        if (pa) return -1;
        if (pb) return 1;
        return 0;
      });
      return arr;
    }
    const s = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va = a[sort.col] ?? "", vb = b[sort.col] ?? "";
      const na = Number(va), nb = Number(vb);
      const numerico = va !== "" && vb !== "" && Number.isFinite(na) && Number.isFinite(nb);
      const cmp = numerico ? na - nb : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return cmp * s;
    });
    return arr;
  }, [visibles, sort]);
  const toggleSort = (col: string) =>
    setSort((prev) => (prev?.col === col ? (prev.dir === "asc" ? { col, dir: "desc" } : null) : { col, dir: "asc" }));

  // KPIs sobre el set buscado (sin el filtro de estado, para que los conteos guíen).
  const kpis = React.useMemo(() => {
    const filas = board?.rows ?? [];
    const counts = new Map<string, number>();
    for (const f of filas) {
      const e = estadoFila(f);
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    // "Todos" refleja lo VISIBLE: si se ocultan canceladas, no las cuenta (evita "Todos: 25" con 22 filas).
    // Los `counts` quedan completos para que la ficha "Cancelada" siga mostrando su número y poder revelarlas.
    const ocultas = ocultarCanceladas && estadoFiltro !== "cancelada" ? (counts.get("cancelada") ?? 0) : 0;
    return { counts, total: filas.length - ocultas };
  }, [board, estadoFila, ocultarCanceladas, estadoFiltro]);

  const cargando = boardRes.state.kind === "loading" || defRes.state.kind === "loading";
  const gateListo = !gate.cargando && !gate.sinCentro && !gate.necesitaPicker;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        count={
          live && (
            <LiveBadge label={t("live")} />
          )
        }
      />

      {/* Layout by view hierarchy: title → service tabs → ONE toolbar row (search + filters | actions). */}
      {gateListo && (
        <ServiciosTabs
          vacioPaciente={!!(!isConsulta && pacienteFiltro && filtroSlugs && serviciosMostrados.length === 0)}
          serviciosVisibles={serviciosVisibles}
          tabEfectivo={tabEfectivo}
          onPick={(slug) => { setTab(slug); setEstadoFiltro(""); }}
          presentesPorClave={presentesPorClave}
          presentesPrefs={presentesPrefs}
          presentesMax={presentesMax}
          extraTab={consultaTab ? { slug: consultaTab.slug, label: tRoot.has(consultaTab.labelKey) ? tRoot(consultaTab.labelKey) : consultaTab.name, color: consultaTab.color } : null}
        />
      )}

      <FrontdeskToolbar
        search={gateListo && (
          /* SINGLE search box: name/record/phone → patient dropdown; picking one narrows the tabs to THEIR services. */
          <FrontdeskSearchBar
            pacienteFiltro={pacienteFiltro}
            nombre={filtroPacienteNombre}
            q={q}
            onQ={setQ}
            mostrarLista={qDeb.trim().length >= 2}
            estado={busqPaciente.state}
            resultados={resultadosPaciente}
            centroNombre={gate.centroNombre}
            dictado={dictado}
            onPick={(p) => { setPacienteFiltro(p); setQ(""); }}
            onClear={() => { setPacienteFiltro(null); setQ(""); }}
          />
        )}
        fecha={fecha}
        onFecha={setFecha}
        hasta={hasta}
        onHasta={setHasta}
        puedeRango={puedeRango}
        centro={gate.centro}
        centros={gate.centros}
        puedeCambiarCentro={gate.puedeCambiar}
        onCentro={gate.pick}
        ocultarCanceladas={ocultarCanceladas}
        onOcultarCanceladas={setOcultarCanceladas}
        acciones={accionesEfectivas}
        onAccion={dispatchAccion}
        onCitar={can("citas.create") ? () => setProgramar({ open: true, servicioId: servicioActivo?.id }) : undefined}
        status={
          <UbicacionEnVivoWidget
            centroId={gate.centro}
            nombreServicio={(slug) => servicios.find((s) => s.slug === slug)?.name}
          />
        }
      />

      {gate.cargando ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : gate.sinCentro ? (
        <p className="text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : gate.necesitaPicker ? (
        <div className="max-w-xl"><CentroPicker centros={gate.centros} onPick={gate.pick} /></div>
      ) : (
        <>
          {isConsulta ? (
            /* "Volver" al facturar se autodetecta de la URL. El buscador de arriba ("Viendo: X") también filtra este tablero. */
            <GenericBoard tablero="atencion" initialEstado={consultaInitialEstado} pacienteFiltro={pacienteFiltro ? { id: pacienteFiltro.id, nombre: filtroPacienteNombre } : null} q={q} />
          ) : (
          <>
          {/* KPIs = filtros */}
          <div className="mb-4 flex flex-wrap gap-2">
            <KpiTile
              label={t("todos")}
              count={kpis.total}
              active={estadoFiltro === ""}
              onClick={() => setEstadoFiltro("")}
            />
            {estados
              .filter((e) => (kpis.counts.get(e.slug) ?? 0) > 0)
              .map((e) => (
                <KpiTile
                  key={e.slug}
                  label={tRoot(e.labelKey)}
                  count={kpis.counts.get(e.slug) ?? 0}
                  color={e.color}
                  active={estadoFiltro === e.slug}
                  onClick={() => setEstadoFiltro(estadoFiltro === e.slug ? "" : e.slug)}
                />
              ))}
          </div>

          {/* Contador de DESCUIDOS del día (§2): siempre visible (0 = día limpio), abre la lista. */}
          {puedeAvisos && avisos && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => avisos.total > 0 && setAvisosOpen(true)}
                disabled={avisos.total === 0}
                className={
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition " +
                  (avisos.total > 0
                    ? "border-warning/40 bg-warning text-warning-foreground hover:bg-warning/80"
                    : "border-border bg-muted/40 text-muted-foreground")
                }
              >
                <HugeiconsIcon
                  icon={avisos.total > 0 ? Alert02Icon : Tick02Icon}
                  className="size-4"
                />
                {avisos.total > 0
                  ? t("avisos.contador", { n: avisos.total })
                  : t("avisos.limpio")}
              </button>
            </div>
          )}

          {/* Contador del DÍA (gramos → viales): se activa solo al abrir la pestaña del servicio. */}
          {board?.totals && board.totals.length > 0 && (
            <TotalesDia totales={board.totals} servicio={servicioActivo?.name} />
          )}

          {cargando && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
          {boardRes.state.kind === "fail" && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {boardRes.state.message}
            </p>
          )}

          {board && !cargando && (
            <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    {colsRender.map((item, i) =>
                      item.kind === "flujo" ? (
                        // Clic en Flujo → orden natural por presente (turno).
                        <th key={`flujo-${i}`} className="px-3 py-2 font-semibold">
                          <button type="button" onClick={() => setSort(null)} className="inline-flex items-center gap-1 hover:text-foreground" title={t("ordenarTurno")}>
                            {t("flujo")}{!sort && <span aria-hidden>•</span>}
                          </button>
                        </th>
                      ) : (
                        <th key={item.col.clave} className="px-3 py-2 font-semibold">
                          <button type="button" onClick={() => toggleSort(item.col.clave)} className="inline-flex items-center gap-1 hover:text-foreground">
                            {item.col.label ?? tRoot(((item.col.render as { labelKey?: string } | null)?.labelKey) ?? item.col.labelKey)}
                            {sort?.col === item.col.clave && <span aria-hidden>{sort.dir === "asc" ? "▲" : "▼"}</span>}
                          </button>
                        </th>
                      ),
                    )}
                    <th className="px-3 py-2 text-right font-semibold">{tRoot("fd.col.acciones")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ordenadas.length === 0 && (
                    <tr>
                      <td colSpan={colsRender.length + 1} className="px-3 py-10 text-center text-muted-foreground">
                        {t("sinFilas")}
                      </td>
                    </tr>
                  )}
                  {ordenadas.map((f) => (
                    <FilaSesion
                      key={f.id}
                      fila={f}
                      sesion={sesiones.get(f.id)}
                      colsRender={colsRender}
                      flujoCols={flujoCols}
                      flujo={flujo.map((e) => ({ clave: e.slug, labelKey: e.labelKey, color: e.color }))}
                      transiciones={def?.transitions ?? []}
                      estadoDe={estadoDe}
                      servicio={servicioActivo}
                      tablero={tabEfectivo}
                      fecha={fecha}
                      optionsByCol={optionsByCol}
                      saldoDosis={saldoByPaciente[String(sesiones.get(f.id)?.patientId ?? "")] ?? []}
                      centro={gate.centro}
                      sinSaldo={sinSaldoIds.has(f.id)}
                      canReparar={can("frontdesk.reparar")}
                      estados={estados.map((e) => ({ clave: e.slug, label: tRoot(e.labelKey) }))}
                      onChanged={refetch}
                      onProgramar={(ctx) => setProgramar({ open: true, ...ctx, servicioId: ctx.servicioId ?? servicioActivo?.id })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>
          )}
        </>
      )}

      {/* Leyenda del flujo (data-driven): sale del NOMBRE de las columnas del flujo (configurable) +
          el color de su estado destino. Como el mockup del AP-Board. */}
      {!isConsulta && flujoCols.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
          {flujoCols.map((c, i) => {
            const r = (c.render ?? {}) as { transition?: string; labelKey?: string; color?: string };
            const color = (c as { color?: string | null }).color ?? r.color ?? flujo[i]?.color ?? estadoDe(r.transition ?? c.clave)?.color;
            return (
              <span key={c.clave} className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color ?? "var(--muted-foreground)" }} aria-hidden />
                {tRoot(flujo[i]?.labelKey ?? r.labelKey ?? c.labelKey)}
              </span>
            );
          })}
        </div>
      )}

      <ProgramarCitasModal
        open={programar.open}
        onOpenChange={(o) => setProgramar((p) => ({ ...p, open: o }))}
        centro={gate.centro}
        pacienteId={programar.pacienteId}
        pacienteNombre={programar.pacienteNombre}
        defaultServicioId={programar.servicioId}
        onDone={refetch}
      />

      {/* Lista de DESCUIDOS del día (§2): paciente, servicio y quién lo hizo, con los tres contadores
          arriba. Clic en una fila → filtra el tablero a ese paciente para abrir su sesión y repararla. */}
      <Dialog open={avisosOpen} onOpenChange={setAvisosOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("avisos.titulo")}</DialogTitle>
            <DialogDescription>{t("avisos.desc")}</DialogDescription>
          </DialogHeader>
          {avisos && (
            <>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {(["entrega_sin_paquete", "dosis_no_comprada", "entrega_sin_saldo"] as const).map((tp) => (
                  <span
                    key={tp}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                  >
                    <span className="font-semibold tabular-nums">{avisos.byType?.[tp] ?? 0}</span>
                    <span className="text-muted-foreground">{t(`avisos.tipo.${tp}`)}</span>
                  </span>
                ))}
              </div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {avisos.avisos.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t("avisos.limpio")}</p>
                ) : (
                  avisos.avisos.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        // Traer la sesión al tablero para repararla: filtra por el paciente del aviso.
                        if (a.patient) setQ(a.patient);
                        setAvisosOpen(false);
                      }}
                      className="flex w-full items-start justify-between gap-3 rounded-md bg-card p-3 text-left ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] transition hover:bg-accent/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-block rounded-full bg-warning px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
                            {t.has(`avisos.tipo.${a.type}`) ? t(`avisos.tipo.${a.type}`) : a.type}
                          </span>
                          <span className="truncate font-medium">{a.patient ?? "—"}</span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {a.service ?? "—"}
                          {a.actor ? ` · ${t("avisos.por", { actor: a.actor })}` : ""}
                        </div>
                      </div>
                      {a.cuando && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {fmtHora(a.cuando)}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// Plural español simple para la unidad del insumo (vial→viales, caja→cajas; "dosis" no cambia).
function pluralES(u: string, n: number): string {
  if (!u || n === 1) return u ?? "";
  if (/s$/i.test(u)) return u; // ya termina en s (dosis)
  return /[aeiouáéíóú]$/i.test(u) ? `${u}s` : `${u}es`;
}

// ————— Contador del DÍA por servicio (gramos → viales) —————
// Se activa al abrir la pestaña (llega en `totales`). Muestra el total con su unidad y, si hay
// equivalencia, los viales SIN redondear (el decimal dice que quedó vial abierto). Sin equivalencia,
// solo el total. Data-driven: N contadores. Handoff HANDOFF-contador-del-dia-en-el-tablero.
function TotalesDia({ totales, servicio }: { totales: FrontdeskTotal[]; servicio?: string }) {
  const tRoot = useTranslations();
  const t = useTranslations("frontdesk");
  const nf = new Intl.NumberFormat("es-PR", { maximumFractionDigits: 2 });
  const rotulo = (x: FrontdeskTotal) => (tRoot.has(x.labelKey) ? tRoot(x.labelKey) : x.columna);
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      {totales.map((x) => {
        const eq = x.equivalencia;
        return (
          <div
            key={x.columna}
            className="flex items-center gap-4 rounded-md bg-card bg-gradient-to-br from-primary/10 to-transparent px-4 py-2.5 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10"
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {[servicio, t("hoy")].filter(Boolean).join(" · ")}
              </span>
              <span className="text-sm font-medium">{rotulo(x)}</span>
            </div>
            <span className="text-2xl font-bold tabular-nums">
              {nf.format(x.total)}
              {x.unidad ? <span className="ml-1 text-base font-semibold text-muted-foreground">{x.unidad}</span> : null}
            </span>
            {eq && eq.cantidad != null && (
              <span
                className="rounded-lg bg-background/70 px-2.5 py-1 text-lg font-semibold tabular-nums ring-1 ring-border"
                title={eq.capacidad != null ? t("vialDe", { capacidad: nf.format(eq.capacidad), unidad: x.unidad ?? "" }) : undefined}
              >
                {nf.format(eq.cantidad)}
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  {eq.unidad ? pluralES(eq.unidad, Number(eq.cantidad)) : t("viales")}
                </span>
              </span>
            )}
          </div>
        );
      })}
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
        "group flex min-w-24 flex-col items-start gap-1 rounded-md bg-card px-4 py-3 text-left shadow-sm shadow-[rgba(16,32,64,0.06)] transition-colors " +
        (active
          ? "bg-primary/[0.04] ring-2 ring-primary/50"
          : "ring-1 ring-foreground/10 hover:ring-foreground/20")
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

