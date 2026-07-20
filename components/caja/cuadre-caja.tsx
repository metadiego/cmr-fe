"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  abrirCuadre,
  cerrarCuadre,
  contarCuadre,
  enviarCuadreEmail,
  getCuadre,
  getDenominaciones,
  getReporteDia,
  listarCuadres,
  type CajaDivision,
  type CuadreConItems,
  type CuadreCaja as CuadreRow,
  type Denominacion,
  type ReporteDia,
} from "@/lib/api/caja";
import { apiErrorMessage } from "@/lib/api/errors";
import { toCsv } from "@/lib/caja/export";
import { totalConteo, diferenciaCaja } from "@/lib/caja/totales";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { useMe } from "@/hooks/use-me";
import { useCan } from "@/hooks/use-can";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { ConteoDenominaciones } from "@/components/caja/conteo-denominaciones";
import { ResumenPagos } from "@/components/caja/resumen-pagos";
import { DesgloseCajeros } from "@/components/caja/desglose-cajeros";
import { FacturasPendientes } from "@/components/caja/facturas-pendientes";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GERENCIA = ["admin", "super_admin", "gerente"];
// Default de INTERFAZ del Inicio (fondo de apertura). Acordado con el BE (PR #120): dato del FE,
// el backend NO lo hardcodea. Configurable a futuro por centro si el negocio lo pide.
const DEFAULT_INICIO = 50;

// Alcance del cuadre: cajero fijo en sí mismo; gerencia elige consolidado o un cajero.
type Scope = "self" | "consolidated" | `user:${string}`;
function scopeUsuarioId(s: Scope): string | null | undefined {
  if (s === "self") return undefined; // el BE resuelve al propio usuario
  if (s === "consolidated") return null; // consolidado (todos)
  return s.slice("user:".length);
}

// Cuadre de Caja por DIVISIÓN (destino fijo: consulta | general, NUNCA mezclados). Multi-tenant
// por el gate de centro; RBAC cosmético para cerrar. See docs/specs/2026-07-20-cuadre-caja-design.md.
export function CuadreCaja({ division }: { division: CajaDivision }) {
  const t = useTranslations("caja");
  const tc = useTranslations("common");
  const gate = useCentroGate();
  const meState = useMe();
  const { can } = useCan();

  const me = meState.kind === "ok" ? meState.me : null;
  const isGerencia =
    !!me && (me.isMaster || me.roles.some((r) => GERENCIA.includes(r)));
  const canCerrar = can("caja.cerrar");
  // Editar fechas ANTERIORES está bloqueado por defecto (seguridad). Es CONFIGURABLE por RBAC
  // (data-driven, lo concede el admin): el permiso `caja.retroactivo` lo habilita. Por ahora la
  // gerencia (admin/super_admin/gerente) y el master lo tienen abierto.
  const puedeRetroactivo = isGerencia || can("caja.retroactivo");
  const hoy = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = React.useState(hoy);
  const [scope, setScope] = React.useState<Scope | null>(null);
  const effScope: Scope = scope ?? (isGerencia ? "consolidated" : "self");

  if (gate.cargando || meState.kind === "loading") {
    return (
      <Shell division={division}>
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      </Shell>
    );
  }
  if (gate.sinCentro) {
    return (
      <Shell division={division}>
        <p className="text-sm text-muted-foreground">{t("sinCentro")}</p>
      </Shell>
    );
  }
  if (gate.necesitaPicker) {
    return (
      <Shell division={division}>
        <CentroPicker centros={gate.centros} onPick={gate.pick} />
      </Shell>
    );
  }

  return (
    <Shell division={division} centroNombre={gate.centroNombre}>
      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="caja-fecha" className="text-sm text-muted-foreground">
          {t("date")}
        </Label>
        <Input
          id="caja-fecha"
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => setFecha(e.target.value || hoy)}
          className="h-9 w-40"
        />
      </div>

      <Loader
        key={`${division}:${effScope}:${gate.centro}:${fecha}`}
        division={division}
        fecha={fecha}
        esHoy={fecha === hoy}
        scope={effScope}
        setScope={setScope}
        isGerencia={isGerencia}
        puedeRetroactivo={puedeRetroactivo}
        meId={me?.id ?? null}
        canCerrar={canCerrar}
        centro={gate.centro}
      />
    </Shell>
  );
}

function Shell({
  division,
  children,
  centroNombre,
}: {
  division: CajaDivision;
  children: React.ReactNode;
  centroNombre?: string;
}) {
  const t = useTranslations("caja");
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div
        className={cn(
          "mb-1 flex flex-wrap items-center gap-3 border-l-4 pl-3",
          division === "consulta" ? "border-l-sky-500" : "border-l-emerald-500",
        )}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("title")} — {t(`division.${division}`)}
        </h1>
        {centroNombre && (
          <Badge variant="secondary" className="font-normal">
            {centroNombre}
          </Badge>
        )}
      </div>
      <p className="mb-6 pl-3 text-sm text-muted-foreground">{t("help")}</p>
      {children}
    </div>
  );
}

type LoaderProps = {
  division: CajaDivision;
  fecha: string;
  esHoy: boolean;
  scope: Scope;
  setScope: (s: Scope) => void;
  isGerencia: boolean;
  puedeRetroactivo: boolean;
  meId: string | null;
  canCerrar: boolean;
  centro?: string;
};

// Carga el reporte del día + denominaciones + los cuadres de esa (fecha × división). Para un cajero
// concreto prellena su cuadre (conteo/inicio); para el CONSOLIDADO trae TODOS los cuadres para unir
// (sumar) el efectivo contado y el fondo de cada cajero.
function Loader(props: LoaderProps) {
  const tc = useTranslations("common");
  const t = useTranslations("caja");
  const { division, fecha, scope } = props;
  const usuarioId = scopeUsuarioId(scope);
  const esConsolidado = usuarioId === null;
  const usuarioIdParam = usuarioId ?? undefined;

  const bundle = useResource(async () => {
    const [reporte, denoms, lista] = await Promise.all([
      getReporteDia(fecha, division, usuarioId),
      getDenominaciones(),
      listarCuadres({ fecha, division, usuarioId: usuarioIdParam }),
    ]);
    // Cuadro editable: solo para un cajero concreto (no el consolidado). Trae su conteo detallado.
    const found = esConsolidado ? null : lista[0];
    const cuadre = found ? await getCuadre(found.id) : null;
    return { reporte, denoms, cuadre, cuadres: lista };
  }, []);

  if (bundle.state.kind === "loading")
    return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (bundle.state.kind !== "ok")
    return <p className="text-sm text-destructive">{bundle.state.message}</p>;

  const { reporte, denoms, cuadre, cuadres } = bundle.state.data;
  return (
    <Editor
      key={cuadre?.id ?? "nuevo"}
      {...props}
      reporte={reporte}
      denoms={denoms}
      cuadreInicial={cuadre}
      cuadres={cuadres}
      onReload={bundle.reload}
      labelHint={t("count.hint")}
    />
  );
}

function Editor({
  division,
  fecha,
  esHoy,
  scope,
  setScope,
  isGerencia,
  puedeRetroactivo,
  meId,
  canCerrar,
  centro,
  reporte,
  denoms,
  cuadreInicial,
  cuadres,
  onReload,
  labelHint,
}: LoaderProps & {
  reporte: ReporteDia;
  denoms: Denominacion[];
  cuadreInicial: CuadreConItems | null;
  cuadres: CuadreRow[];
  onReload: () => void;
  labelHint: string;
}) {
  const t = useTranslations("caja");

  const usuarioId = scopeUsuarioId(scope);
  const esConsolidado = usuarioId === null;
  const cerrado = cuadreInicial?.estado === "cerrado";
  // Contar habilitado: cajero concreto, no cerrado, y (hoy O permiso de retroactivo — RBAC). El
  // consolidado NO se cuenta (es la UNIÓN de todos los cajeros); tampoco fechas pasadas sin permiso.
  const contarHabilitado =
    !cerrado && !esConsolidado && (esHoy || puedeRetroactivo);

  const [conteo, setConteo] = React.useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const c of cuadreInicial?.conteo ?? []) m[c.denominacionId] = c.cantidad;
    return m;
  });
  const [inicioStr, setInicioStr] = React.useState<string>(
    String(cuadreInicial?.pettyDeclarado ?? DEFAULT_INICIO),
  );
  const [aplicarInicio, setAplicarInicio] = React.useState(true);
  const [procesando, setProcesando] = React.useState(false);
  const [emailing, setEmailing] = React.useState(false);

  // Conteo/inicio por cajero (de los cuadres del día) para UNIR en el consolidado.
  const conteoPorCajero = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cuadres) if (c.usuarioId) m[c.usuarioId] = c.efectivoContado;
    return m;
  }, [cuadres]);
  const contadoConsolidado = React.useMemo(
    () => cuadres.reduce((s, c) => s + (c.efectivoContado || 0), 0),
    [cuadres],
  );
  const inicioConsolidado = React.useMemo(
    () => cuadres.reduce((s, c) => s + (c.pettyDeclarado || 0), 0),
    [cuadres],
  );

  const contadoLocal = React.useMemo(
    () => totalConteo(denoms.map((d) => ({ valor: d.valor, cantidad: conteo[d.id] ?? 0 }))),
    [denoms, conteo],
  );
  // En consolidado: los totales son la UNIÓN de todos los cajeros (no un conteo propio).
  const inicio = esConsolidado
    ? inicioConsolidado
    : aplicarInicio
      ? Math.max(0, Number(inicioStr) || 0)
      : 0;
  const contado = esConsolidado ? contadoConsolidado : contadoLocal;
  const salesCash = reporte.detalle.efectivo.monto;
  const diferencia =
    cerrado && !esConsolidado
      ? (cuadreInicial?.diferencia ?? 0)
      : diferenciaCaja(salesCash, contado, inicio);
  const porCajero = reporte.porCajero ?? [];

  async function procesarCierre() {
    setProcesando(true);
    try {
      const abierto = await abrirCuadre({
        division,
        usuarioId,
        fecha,
        pettyDeclarado: inicio,
      });
      const lineas = Object.entries(conteo)
        .filter(([, c]) => c > 0)
        .map(([denominacionId, cantidad]) => ({ denominacionId, cantidad }));
      if (lineas.length) await contarCuadre(abierto.id, lineas);
      await cerrarCuadre(abierto.id);
      toast.success(t("closeConfirmOk"));
      onReload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setProcesando(false);
    }
  }

  async function enviarEmail(email: string) {
    if (!cuadreInicial) return;
    setEmailing(true);
    try {
      await enviarCuadreEmail(cuadreInicial.id, { email });
      toast.success(t("emailSent"));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setEmailing(false);
    }
  }

  function exportar() {
    const r = reporte;
    const rows: Array<Array<string | number>> = [
      [t("title"), t(`division.${division}`), fecha],
      [],
      [t("payments.cards")],
      [t("payments.type"), t("payments.qty"), t("payments.amount")],
      ...r.detalle.tarjetas.map((x) => [x.nombre, x.cantidad, x.monto]),
      [t("payments.totalCards"), "", r.detalle.totalTarjetas],
      [],
      [t("payments.otherMethods")],
      ...r.detalle.otros.map((x) => [x.nombre, x.cantidad, x.monto]),
      [],
      [t("payments.general")],
      [t("payments.opening"), inicio],
      [t("payments.salesCash"), r.detalle.efectivo.monto],
      [t("payments.electronic"), r.detalle.totalElectronicas],
      [t("payments.totalCMA"), r.detalle.total],
      [t("payments.grossBilling"), r.ventas.bruto],
      [t("payments.returns"), r.devoluciones.total],
      [t("payments.netBilling"), r.ventas.neto],
      [t("payments.cashInDrawer"), contado],
      [t("summary.variance"), diferencia],
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuadre-${division}-${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("exported"));
  }

  const hint = esConsolidado
    ? labelHint
    : !esHoy && !puedeRetroactivo
      ? t("count.pastLocked")
      : undefined;

  return (
    <div className="space-y-4">
      {/* Selector de alcance (solo gerencia) */}
      {isGerencia && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">{t("scope.label")}</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger className="h-9 w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consolidated">{t("scope.consolidated")}</SelectItem>
              {porCajero
                .filter((c) => c.usuarioId)
                .map((c) => (
                  <SelectItem key={c.usuarioId} value={`user:${c.usuarioId}`}>
                    {c.nombre ??
                      (c.usuarioId === meId ? t("scope.mine") : (c.usuarioId ?? "").slice(0, 8))}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {cerrado && (
            <Badge variant="secondary">{t("status.cerrado")}</Badge>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Panel izquierdo: conteo + inicio + resumen por cajero */}
        <div className="space-y-4">
          <ConteoDenominaciones
            denominaciones={denoms}
            cantidades={conteo}
            disabled={!contarHabilitado}
            hint={hint}
            onChange={(id, cantidad) => setConteo((prev) => ({ ...prev, [id]: cantidad }))}
          />

          {/* Inicio (fondo de apertura) — input con aplicar/limpiar (calca CMA). En consolidado no
              se edita: el Inicio es la suma de los fondos de cada cajero (se ve en el resumen). */}
          {!esConsolidado && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
              <Label htmlFor="inicio" className="text-sm font-medium">
                {t("payments.opening")}
              </Label>
              <Input
                id="inicio"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                disabled={!contarHabilitado || !aplicarInicio}
                value={inicioStr}
                onChange={(e) => setInicioStr(e.target.value)}
                className="h-9 w-28 text-right tabular-nums"
              />
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Checkbox
                  checked={aplicarInicio}
                  disabled={!contarHabilitado}
                  onCheckedChange={(v) => setAplicarInicio(v === true)}
                />
                {t("applyOpening")}
              </label>
            </div>
          )}

          {isGerencia && (
            <DesgloseCajeros
              cajeros={porCajero}
              conteoPorCajero={conteoPorCajero}
              meId={meId}
              activeUsuarioId={scope.startsWith("user:") ? scope.slice(5) : null}
              onPick={(uid) => setScope(uid ? (`user:${uid}` as Scope) : "consolidated")}
            />
          )}
        </div>

        {/* Panel derecho: resumen de pagos + acciones */}
        <ResumenPagos
          division={division}
          detalle={reporte.detalle}
          ventas={reporte.ventas}
          devoluciones={reporte.devoluciones}
          inicio={inicio}
          salesCash={salesCash}
          contado={contado}
          diferencia={diferencia}
          cerrado={cerrado}
          cerradoEn={cuadreInicial?.cerradoEn ?? null}
          canProcesar={contarHabilitado && canCerrar}
          procesando={procesando}
          onProcesar={procesarCierre}
          onExport={exportar}
          canEmail={!!cuadreInicial}
          emailing={emailing}
          onEmail={enviarEmail}
        />
      </div>

      {/* Facturas pendientes */}
      <FacturasPendientes pendientes={reporte.pendientes} centroId={centro} />
    </div>
  );
}
