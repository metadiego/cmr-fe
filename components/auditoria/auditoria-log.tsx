"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

import {
  listAuditoria,
  getAuditoriaFacetas,
  getAuditoriaResumen,
  type AuditRow,
  type AuditListParams,
  type AuditFacetas,
  type AuditResumen,
} from "@/lib/api/auditoria";
import type { Paginated } from "@/lib/api/types";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { puedeVerTodosLosCentros } from "@/lib/centros-scope";
import { useResource } from "@/hooks/use-resource";
import { useMe, isAdmin } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import { DataTable, type Column } from "@/components/kit/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuditDetailSheet } from "./audit-detail-sheet";
import { ResumenCards } from "./audit-summary-cards";
import { agentTool, auditVia } from "@/lib/audit/via";

// Fallback de dominios SOLO si /auditoria/facetas aún no cargó o viene vacío (el desplegable se
// llena con facetas.dominios, que son los valores realmente presentes).
const DOMINIOS = [
  "pacientes",
  "facturas",
  "citas",
  "inventario",
  "comunicaciones",
  "frontdesk",
  "tablero",
  "auth",
] as const;
const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const TODOS = "__todos__"; // Radix Select no admite value=""

// Verbo humano según el método (frase para el usuario; el `accion` crudo queda en el tooltip).
const VERBO: Record<string, string> = {
  POST: "creo",
  PUT: "edito",
  PATCH: "edito",
  DELETE: "elimino",
  GET: "consulto",
};

// Rango por defecto: últimos 7 días (ISO yyyy-mm-dd para el input date).
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// `initial*` seed the filters once, for a caller that opens this reused (never copied — rule 9)
// as a scoped drill-down, e.g. "what did this person do that day" from the Sessions tab. The
// caller remounts with a fresh `key` per target instead of this component reacting to prop changes.
export function AuditoriaLog({
  initialUserId,
  initialUserLabel,
  initialSessionId,
  initialDesde,
  initialHasta,
}: {
  initialUserId?: string;
  initialUserLabel?: string;
  initialSessionId?: string;
  initialDesde?: string;
  initialHasta?: string;
} = {}) {
  const t = useTranslations("auditoria");
  const format = useFormatter();
  const tc = useTranslations("common");

  // Filtros (los que el endpoint soporta de verdad). page se resetea al cambiar cualquier filtro.
  const [desde, setDesde] = React.useState(initialDesde ?? isoDaysAgo(7));
  const [hasta, setHasta] = React.useState(initialHasta ?? "");
  const [dominio, setDominio] = React.useState(TODOS);
  const [accion, setAccion] = React.useState(TODOS);
  const [resultado, setResultado] = React.useState(TODOS);
  const [metodo, setMetodo] = React.useState(TODOS);
  const [clinicId, setClinicId] = React.useState(TODOS);
  const [via, setVia] = React.useState(TODOS); // "rest" (the app) | "mcp" (Claude)
  // Chips (BE cmr-be): soloCambios = solo mutaciones; ocultarRuido = excluirErrorCode=RATE_LIMITED.
  // "Ocultar límite de tasa" arranca ENCENDIDO: el 81% de los errores son RATE_LIMITED (ruido).
  const [soloCambios, setSoloCambios] = React.useState(false);
  const [ocultarRuido, setOcultarRuido] = React.useState(true);
  // Filtro por usuario: el BE filtra por userId (authUserId), pero el perfil no expone ese id → no
  // hay mapa nombre→id en el cliente. Se activa clicando la celda Usuario de una fila (trae ambos).
  const [userId, setUserId] = React.useState(initialUserId ?? "");
  const [userLabel, setUserLabel] = React.useState(initialUserLabel ?? "");
  const [entidadId, setEntidadId] = React.useState(""); // one session, one invoice… (from the detail panel)
  const [sessionIdFilter, setSessionIdFilter] = React.useState(initialSessionId ?? ""); // one login session (cmr-be #652)
  const [page, setPage] = React.useState(1);
  const [detalle, setDetalle] = React.useState<AuditRow | null>(null);

  function filtrarPorUsuario(id: string, label: string) {
    setUserId(id);
    setUserLabel(label);
    setPage(1);
  }
  function limpiarUsuario() {
    setUserId("");
    setUserLabel("");
    setPage(1);
  }

  const me = useMe();
  const admin = me.kind === "ok" && isAdmin(me.me);
  // Solo admin/master ven varios centros; para el resto el BE FIJA su centro e ignora clinicId, así
  // que ofrecer el selector sería engañoso (elegir otro centro no haría nada).
  const verTodos = puedeVerTodosLosCentros(me.kind === "ok" ? me.me : null);

  const { state: centrosState } = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosState.kind === "ok" ? centrosState.data : [];
  const centroNombre = (id: string | null) =>
    id ? centros.find((c) => c.id === id)?.name ?? id.slice(0, 8) : "—";

  // Resumen (conteos, no filas) para las tarjetas de la cabecera. Recalcula con el rango de fechas.
  const resumenKey = `${desde}|${hasta}`;
  const { state: resumenState } = useResource<AuditResumen>(
    () => getAuditoriaResumen({ desde: desde || undefined, hasta: hasta || undefined }),
    [resumenKey],
  );
  const resumen = resumenState.kind === "ok" ? resumenState.data : null;

  // Facetas: valores realmente presentes para los desplegables (sin hardcode). Se recalculan al
  // cambiar el rango de fechas. Fallback a la lista conocida si aún no cargaron o vienen vacías.
  const facetasKey = `${desde}|${hasta}`;
  const { state: facetasState } = useResource<AuditFacetas>(
    () => getAuditoriaFacetas({ desde: desde || undefined, hasta: hasta || undefined }),
    [facetasKey],
  );
  const facetas = facetasState.kind === "ok" ? facetasState.data : null;
  const dominiosOpts = facetas && facetas.dominios.length > 0 ? facetas.dominios : [...DOMINIOS];
  const accionesOpts = facetas?.acciones ?? []; // solo llega con scope admin (identificadores internos)
  // Solo mostrar/aplicar el chip de ruido si RATE_LIMITED existe de verdad en la ventana (data-driven).
  const hayRateLimited = !facetas || facetas.errorCodes.includes("RATE_LIMITED");

  const params: AuditListParams = {
    desde: desde || undefined,
    hasta: hasta || undefined,
    dominio: dominio === TODOS ? undefined : dominio,
    accion: accion === TODOS ? undefined : accion,
    resultado: resultado === TODOS ? undefined : (resultado as "ok" | "error"),
    metodo: metodo === TODOS ? undefined : metodo,
    soloCambios: soloCambios || undefined,
    excluirErrorCode: ocultarRuido && hayRateLimited ? "RATE_LIMITED" : undefined,
    userId: userId || undefined,
    entidadId: entidadId || undefined,
    sessionId: sessionIdFilter || undefined,
    clinicId: clinicId === TODOS ? undefined : clinicId,
    channel: via === TODOS ? undefined : (via as "rest" | "mcp"),
    page,
    limit: 50,
  };
  const key = JSON.stringify(params);
  const { state, reload } = useResource<Paginated<AuditRow>>(() => listAuditoria(params), [key]);
  // La tabla recibe solo las filas (envelope { data: filas, meta.pagination }); el total va al paginador.
  const rowsState = React.useMemo(
    () =>
      state.kind === "ok"
        ? ({ kind: "ok" as const, data: state.data.items })
        : state,
    [state],
  );
  const meta =
    state.kind === "ok" ? state.data.pagination : { total: 0, page, limit: 50 };

  // Al cambiar un filtro, volver a la página 1.
  function onFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const frase = (r: AuditRow) => {
    const v = VERBO[r.metodo] ?? "accion";
    const dom = t.has(`dominio.${r.dominio}`) ? t(`dominio.${r.dominio}`) : r.dominio;
    return `${t(`verbo.${v}`)} · ${dom}`;
  };

  async function copiar(txt: string) {
    try {
      await navigator.clipboard.writeText(txt);
      toast.success(t("copiado"));
    } catch {
      toast.error(t("copiaError"));
    }
  }

  const columns: Column<AuditRow>[] = [
    {
      key: "fecha",
      header: t("col.fecha"),
      cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{format.dateTime(new Date(r.createdAt), "dateAndTime")}</span>,
    },
    {
      key: "usuario",
      header: t("col.usuario"),
      // Clic en el usuario = filtrar por esa persona (sin salir de la tabla). stopPropagation para
      // no abrir el panel de detalle de la fila.
      cell: (r) =>
        r.userId ? (
          <Tooltip content={t("filtrarPorUsuario")}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                filtrarPorUsuario(r.userId!, r.usuarioNombre ?? r.userId!);
              }}
              className="text-left hover:text-foreground hover:underline"
            >
              {r.usuarioNombre ? (
                <span className="text-sm">{r.usuarioNombre}</span>
              ) : (
                <span className="font-mono text-xs">{r.userId.slice(0, 8)}</span>
              )}
            </button>
          </Tooltip>
        ) : (
          <span className={r.usuarioNombre ? "text-sm" : "text-muted-foreground"}>{r.usuarioNombre ?? "—"}</span>
        ),
    },
    {
      key: "dominio",
      header: t("col.dominio"),
      cell: (r) => (
        <Badge variant="outline" className="font-normal">
          {t.has(`dominio.${r.dominio}`) ? t(`dominio.${r.dominio}`) : r.dominio}
        </Badge>
      ),
    },
    {
      key: "accion",
      header: t("col.accion"),
      cell: (r) => (
        <Tooltip content={r.accion}>
          {agentTool(r) ? (
            <span className="font-mono text-xs">{agentTool(r)}</span>
          ) : (
            <span className="text-sm">{frase(r)}</span>
          )}
        </Tooltip>
      ),
    },
    {
      key: "via",
      header: t("col.via"),
      cell: (r) => (
        <Badge variant={auditVia(r) === "claude" ? "default" : "outline"} className="font-normal">
          {t(`via.${auditVia(r)}`)}
        </Badge>
      ),
    },
    {
      key: "metodo",
      header: t("col.metodo"),
      cell: (r) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-mono text-xs text-muted-foreground">{r.metodo}</span>
          <Badge variant={r.resultado === "error" ? "destructive" : "secondary"}>
            {r.statusCode ?? r.resultado}
          </Badge>
        </span>
      ),
    },
    {
      key: "duracion",
      header: t("col.duracion"),
      align: "right",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.durationMs != null ? `${r.durationMs} ms` : "—"}
        </span>
      ),
    },
    {
      key: "centro",
      header: t("col.centro"),
      cell: (r) => <span className="text-xs text-muted-foreground">{centroNombre(r.clinicId)}</span>,
    },
  ];

  const selectAll = (
    value: string,
    onValueChange: (v: string) => void,
    placeholder: string,
    options: { value: string; label: string }[],
  ) => (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{t("todos")}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      {/* Tarjetas de resumen (conteos) + purga (admin). */}
      {resumen ? <ResumenCards resumen={resumen} admin={admin} /> : null}

      {/* Barra de filtros — una fila que se envuelve en móvil. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1">
          <Label className="text-xs">{t("desde")}</Label>
          <DatePicker className="h-9" value={desde} onChange={onFilter(setDesde)} clearable />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("hasta")}</Label>
          <DatePicker className="h-9" value={hasta} onChange={onFilter(setHasta)} clearable />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("col.dominio")}</Label>
          {selectAll(dominio, onFilter(setDominio), t("todos"), dominiosOpts.map((d) => ({
            value: d,
            label: t.has(`dominio.${d}`) ? t(`dominio.${d}`) : d,
          })))}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("col.metodo")}</Label>
          {selectAll(metodo, onFilter(setMetodo), t("todos"), METODOS.map((m) => ({ value: m, label: m })))}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("col.resultado")}</Label>
          {selectAll(resultado, onFilter(setResultado), t("todos"), [
            { value: "ok", label: t("resultadoOk") },
            { value: "error", label: t("resultadoError") },
          ])}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("col.via")}</Label>
          {selectAll(via, onFilter(setVia), t("todos"), [
            { value: "rest", label: t("via.app") },
            { value: "mcp", label: t("via.claude") },
          ])}
        </div>
        {/* Acción (Controller.handler): la pregunta más afilada de una bitácora. Solo admin (las
            acciones son identificadores internos y el BE solo las expone con scope admin). */}
        {admin && accionesOpts.length > 0 ? (
          <div className="space-y-1">
            <Label className="text-xs">{t("col.accion")}</Label>
            {selectAll(accion, onFilter(setAccion), t("todos"), accionesOpts.map((a) => ({ value: a, label: a })))}
          </div>
        ) : null}
        {/* Centro: solo para quien puede ver varios centros (admin/master). */}
        {verTodos ? (
          <div className="space-y-1">
            <Label className="text-xs">{t("col.centro")}</Label>
            {selectAll(clinicId, onFilter(setClinicId), t("todos"), centros.map((c) => ({ value: c.id, label: c.name })))}
          </div>
        ) : null}
      </div>

      {/* Chips rápidos + recargar. "Solo errores" usa resultado=error (soportado por el BE). */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={soloCambios ? "default" : "outline"}
          onClick={() => {
            setSoloCambios((v) => !v);
            setPage(1);
          }}
        >
          {t("chipSoloCambios")}
        </Button>
        <Button
          size="sm"
          variant={resultado === "error" ? "default" : "outline"}
          onClick={() => onFilter(setResultado)(resultado === "error" ? TODOS : "error")}
        >
          {t("chipSoloErrores")}
        </Button>
        {hayRateLimited ? (
          <Button
            size="sm"
            variant={ocultarRuido ? "default" : "outline"}
            onClick={() => {
              setOcultarRuido((v) => !v);
              setPage(1);
            }}
          >
            {t("chipOcultarRuido")}
          </Button>
        ) : null}
        {userId ? (
          <Button size="sm" variant="secondary" onClick={limpiarUsuario} className="gap-1">
            {t("filtroUsuario", { nombre: userLabel })}
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </Button>
        ) : null}
        {entidadId ? (
          <Button size="sm" variant="secondary" onClick={() => { setEntidadId(""); setPage(1); }} className="gap-1">
            {t("filtroEntidad", { id: entidadId.slice(0, 8) })}
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </Button>
        ) : null}
        {sessionIdFilter ? (
          <Button size="sm" variant="secondary" onClick={() => { setSessionIdFilter(""); setPage(1); }} className="gap-1">
            {t("filtroSesion", { id: sessionIdFilter.slice(0, 8) })}
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </Button>
        ) : null}
        <span className="ml-auto flex items-center gap-3">
          {state.kind === "ok" ? (
            <span className="text-xs text-muted-foreground">{t("totalRegistros", { total: meta.total })}</span>
          ) : null}
          <Button size="sm" variant="outline" onClick={reload}>
            <HugeiconsIcon icon={RefreshIcon} className="size-4" />
            {tc("retry")}
          </Button>
        </span>
      </div>

      <DataTable
        columns={columns}
        state={rowsState}
        getRowKey={(r) => r.id}
        onReload={reload}
        onRowClick={(r) => setDetalle(r)}
        pagination={{ meta, onPageChange: setPage }}
        labels={{ empty: t("vacio") }}
      />

      <AuditDetailSheet
        row={detalle}
        onClose={() => setDetalle(null)}
        centerName={centroNombre}
        onCopy={copiar}
        onEntity={(id) => { setEntidadId(id); setPage(1); setDetalle(null); }}
      />
    </div>
  );
}

