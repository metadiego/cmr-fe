"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon, Copy01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

import {
  listAuditoria,
  getAuditoriaFacetas,
  type AuditRow,
  type AuditListParams,
  type AuditFacetas,
} from "@/lib/api/auditoria";
import type { Paginated } from "@/lib/api/types";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Módulos conocidos y verbos: mientras el BE no exponga GET /auditoria/facetas, esta es la lista
// (los índices del BE son por dominio/resultado, así que filtrar por ellos es rápido).
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

export function AuditoriaLog() {
  const t = useTranslations("auditoria");
  const tc = useTranslations("common");

  // Filtros (los que el endpoint soporta de verdad). page se resetea al cambiar cualquier filtro.
  const [desde, setDesde] = React.useState(isoDaysAgo(7));
  const [hasta, setHasta] = React.useState("");
  const [dominio, setDominio] = React.useState(TODOS);
  const [resultado, setResultado] = React.useState(TODOS);
  const [metodo, setMetodo] = React.useState(TODOS);
  const [clinicId, setClinicId] = React.useState(TODOS);
  // Chips (BE cmr-be): soloCambios = solo mutaciones; ocultarRuido = excluirErrorCode=RATE_LIMITED.
  // "Ocultar límite de tasa" arranca ENCENDIDO: el 81% de los errores son RATE_LIMITED (ruido).
  const [soloCambios, setSoloCambios] = React.useState(false);
  const [ocultarRuido, setOcultarRuido] = React.useState(true);
  // Filtro por usuario: el BE filtra por userId (authUserId), pero el perfil no expone ese id → no
  // hay mapa nombre→id en el cliente. Se activa clicando la celda Usuario de una fila (trae ambos).
  const [userId, setUserId] = React.useState("");
  const [userLabel, setUserLabel] = React.useState("");
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

  const { state: centrosState } = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosState.kind === "ok" ? centrosState.data : [];
  const centroNombre = (id: string | null) =>
    id ? centros.find((c) => c.id === id)?.nombre ?? id.slice(0, 8) : "—";

  // Facetas: valores realmente presentes para los desplegables (sin hardcode). Se recalculan al
  // cambiar el rango de fechas. Fallback a la lista conocida si aún no cargaron o vienen vacías.
  const facetasKey = `${desde}|${hasta}`;
  const { state: facetasState } = useResource<AuditFacetas>(
    () => getAuditoriaFacetas({ desde: desde || undefined, hasta: hasta || undefined }),
    [facetasKey],
  );
  const dominiosOpts =
    facetasState.kind === "ok" && facetasState.data.dominios.length > 0
      ? facetasState.data.dominios
      : [...DOMINIOS];

  const params: AuditListParams = {
    desde: desde || undefined,
    hasta: hasta || undefined,
    dominio: dominio === TODOS ? undefined : dominio,
    resultado: resultado === TODOS ? undefined : (resultado as "ok" | "error"),
    metodo: metodo === TODOS ? undefined : metodo,
    soloCambios: soloCambios || undefined,
    excluirErrorCode: ocultarRuido ? "RATE_LIMITED" : undefined,
    userId: userId || undefined,
    clinicId: clinicId === TODOS ? undefined : clinicId,
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
      cell: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
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
          <span className="text-muted-foreground">—</span>
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
          <span className="text-sm">{frase(r)}</span>
        </Tooltip>
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
      {/* Barra de filtros — una fila que se envuelve en móvil. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1">
          <Label className="text-xs">{t("desde")}</Label>
          <Input type="date" className="h-9" value={desde} onChange={(e) => onFilter(setDesde)(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("hasta")}</Label>
          <Input type="date" className="h-9" value={hasta} onChange={(e) => onFilter(setHasta)(e.target.value)} />
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
          <Label className="text-xs">{t("col.centro")}</Label>
          {selectAll(clinicId, onFilter(setClinicId), t("todos"), centros.map((c) => ({ value: c.id, label: c.nombre })))}
        </div>
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
        {userId ? (
          <Button size="sm" variant="secondary" onClick={limpiarUsuario} className="gap-1">
            {t("filtroUsuario", { nombre: userLabel })}
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

      <DetalleSheet
        row={detalle}
        onClose={() => setDetalle(null)}
        centroNombre={centroNombre}
        onCopy={copiar}
      />
    </div>
  );
}

// Panel lateral de detalle: todos los campos crudos + requestId/ip copiables + error completo.
function DetalleSheet({
  row,
  onClose,
  centroNombre,
  onCopy,
}: {
  row: AuditRow | null;
  onClose: () => void;
  centroNombre: (id: string | null) => string;
  onCopy: (txt: string) => void;
}) {
  const t = useTranslations("auditoria");
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t("detalleTitulo")}</SheetTitle>
          <SheetDescription>{row ? new Date(row.createdAt).toLocaleString() : ""}</SheetDescription>
        </SheetHeader>
        {row && (
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5 text-sm">
            <Campo label={t("col.accion")}>
              <span className="font-mono text-xs">{row.accion}</span>
            </Campo>
            <Campo label={t("col.metodo")}>
              <span className="font-mono text-xs">
                {row.metodo} {row.ruta}
              </span>
            </Campo>
            <Campo label={t("col.resultado")}>
              <Badge variant={row.resultado === "error" ? "destructive" : "secondary"}>
                {row.statusCode ?? row.resultado}
              </Badge>
            </Campo>
            <Campo label={t("col.duracion")}>{row.durationMs != null ? `${row.durationMs} ms` : "—"}</Campo>
            <Campo label={t("col.centro")}>{centroNombre(row.clinicId)}</Campo>
            <Campo label={t("col.usuario")}>
              <span className="font-mono text-xs">{row.userId ?? "—"}</span>
              {row.userType ? <span className="ml-2 text-muted-foreground">({row.userType})</span> : null}
            </Campo>
            {row.entidadId ? (
              <Campo label={t("entidadId")}>
                <span className="font-mono text-xs">{row.entidadId}</span>
              </Campo>
            ) : null}
            <CopiableCampo label="requestId" value={row.requestId} onCopy={onCopy} vacio={t("sinDato")} />
            <CopiableCampo label="IP" value={row.ip} onCopy={onCopy} vacio={t("sinDato")} />
            {row.resultado === "error" ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive">{row.errorCode ?? t("error")}</p>
                {row.errorMensaje ? <p className="mt-1 text-xs">{row.errorMensaje}</p> : null}
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function CopiableCampo({
  label,
  value,
  onCopy,
  vacio,
}: {
  label: string;
  value: string | null;
  onCopy: (txt: string) => void;
  vacio: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {value ? (
        <button
          type="button"
          onClick={() => onCopy(value)}
          className={cn("flex items-center gap-1 font-mono text-xs hover:text-foreground")}
        >
          <span className="max-w-[12rem] truncate">{value}</span>
          <HugeiconsIcon icon={Copy01Icon} className="size-3.5 opacity-60" />
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">{vacio}</span>
      )}
    </div>
  );
}
