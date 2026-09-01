"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  abrirCuadre,
  cerrarCuadre,
  contarCuadre,
  enviarCuadreEmail,
  getCajeros,
  getCuadre,
  getDenominaciones,
  getGruposMetodoPago,
  getReporteDia,
  listarCuadres,
  type Cajero,
  type GrupoMetodoPago,
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
import { CuadreDetalle } from "@/components/caja/cuadre-detalle";
import { PageContainer, PageHeader } from "@/components/ui/page";
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
        centroNombre={gate.centroNombre}
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
    <PageContainer>
      <PageHeader
        title={<>{t("title")} — {t(`division.${division}`)}</>}
        description={t("help")}
        count={
          centroNombre && (
            <Badge variant="secondary" className="font-normal">
              {centroNombre}
            </Badge>
          )
        }
      />
      {children}
    </PageContainer>
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
  centroNombre?: string;
};

// Carga el reporte del día + denominaciones + los cuadres de esa (fecha × división). Para un cajero
// concreto prellena su cuadre (conteo/inicio); para el CONSOLIDADO trae TODOS los cuadres para unir
// (sumar) el efectivo contado y el fondo de cada cajero.
function Loader(props: LoaderProps) {
  const tc = useTranslations("common");
  const { division, fecha, scope, isGerencia } = props;
  const usuarioId = scopeUsuarioId(scope);
  const esConsolidado = usuarioId === null;
  const usuarioIdParam = usuarioId ?? undefined;

  const bundle = useResource(async () => {
    const [reporte, denoms, lista, cajeros, grupos] = await Promise.all([
      getReporteDia(fecha, division, usuarioId),
      getDenominaciones(),
      listarCuadres({ fecha, division, usuarioId: usuarioIdParam }),
      // Roster completo de cajeros para el selector (solo gerencia lo necesita; el BE lo acota por rol).
      isGerencia ? getCajeros() : Promise.resolve([] as Cajero[]),
      // Grupos configurables de método de pago (para subtotales informativos, p.ej. visa_mc).
      getGruposMetodoPago(),
    ]);
    // Cuadre editable: un cajero concreto (no el consolidado). En consolidado se traen TODOS los
    // cuadres con su conteo para UNIR (sumar) las cantidades por denominación (vista solo lectura).
    const found = esConsolidado ? null : lista[0];
    const detalles = esConsolidado
      ? await Promise.all(lista.map((c) => getCuadre(c.id)))
      : found
        ? [await getCuadre(found.id)]
        : [];
    const cuadre = esConsolidado ? null : (detalles[0] ?? null);
    // Conteo inicial = unión de las líneas de conteo de los cuadres traídos (por denominacionId).
    const conteoInicial: Record<string, number> = {};
    for (const d of detalles)
      for (const l of d.conteo)
        conteoInicial[l.denominacionId] = (conteoInicial[l.denominacionId] ?? 0) + l.cantidad;
    return { reporte, denoms, cuadre, conteoInicial, cuadres: lista, cajeros, grupos };
  }, []);

  if (bundle.state.kind === "loading")
    return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (bundle.state.kind !== "ok")
    return <p className="text-sm text-destructive">{bundle.state.message}</p>;

  const { reporte, denoms, cuadre, conteoInicial, cuadres, cajeros, grupos } = bundle.state.data;
  return (
    <Editor
      key={cuadre?.id ?? (props.scope === "consolidated" ? "consolidado" : "nuevo")}
      {...props}
      reporte={reporte}
      denoms={denoms}
      cuadreInicial={cuadre}
      conteoInicial={conteoInicial}
      cuadres={cuadres}
      cajeros={cajeros}
      grupos={grupos}
      onReload={bundle.reload}
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
  centroNombre,
  reporte,
  denoms,
  cuadreInicial,
  conteoInicial,
  cuadres,
  cajeros,
  grupos,
  onReload,
}: LoaderProps & {
  reporte: ReporteDia;
  denoms: Denominacion[];
  cuadreInicial: CuadreConItems | null;
  conteoInicial: Record<string, number>;
  cuadres: CuadreRow[];
  cajeros: Cajero[];
  grupos: GrupoMetodoPago[];
  onReload: () => void;
}) {
  const t = useTranslations("caja");

  const usuarioId = scopeUsuarioId(scope);
  const esConsolidado = usuarioId === null;
  const cerrado = cuadreInicial?.estado === "cerrado";
  // Contar habilitado: cajero concreto, no cerrado, y (hoy O permiso de retroactivo — RBAC). El
  // consolidado NO se cuenta (es la UNIÓN de todos los cajeros); tampoco fechas pasadas sin permiso.
  const contarHabilitado =
    !cerrado && !esConsolidado && (esHoy || puedeRetroactivo);

  // Conteo inicial: en un cajero = su conteo; en consolidado = la UNIÓN (Σ) de todos (solo lectura).
  const [conteo, setConteo] = React.useState<Record<string, number>>(() => ({ ...conteoInicial }));
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
  // Consolidado = UNIÓN de todos los cajeros (Σ de sus cuadres del día): conteo, fondo, a depositar
  // y diferencia SELLADA. No se recalcula el cierre en el cliente.
  const cons = React.useMemo(() => {
    let contado = 0;
    let inicio = 0;
    let aDepositar = 0;
    let diferencia = 0;
    for (const c of cuadres) {
      contado += c.efectivoContado || 0;
      inicio += c.pettyDeclarado || 0;
      aDepositar += (c.efectivoContado || 0) - (c.pettyDeclarado || 0);
      diferencia += c.diferencia || 0;
    }
    return { contado, inicio, aDepositar, diferencia };
  }, [cuadres]);

  const contadoLocal = React.useMemo(
    () => totalConteo(denoms.map((d) => ({ valor: d.valor, cantidad: conteo[d.id] ?? 0 }))),
    [denoms, conteo],
  );
  const salesCash = reporte.detalle.efectivo.monto;
  const inicio = esConsolidado
    ? cons.inicio
    : aplicarInicio
      ? Math.max(0, Number(inicioStr) || 0)
      : 0;
  const contado = esConsolidado ? cons.contado : contadoLocal;
  // Diferencia (fórmula legacy: contado − inicio − ventasEfectivo). En consolidado = Σ de las
  // diferencias selladas de cada cajero (no aplica un conteo unificado).
  const diferencia = esConsolidado
    ? cons.diferencia
    : cerrado
      ? (cuadreInicial?.diferencia ?? 0)
      : diferenciaCaja(contado, inicio, salesCash);
  const aDepositar = esConsolidado ? cons.aDepositar : contado - inicio;
  const porCajero = reporte.porCajero ?? [];

  // Subtotales informativos de tarjetas (p.ej. "VISA + MASTERCARD"): grupos configurables cuyas
  // formas son subconjunto ESTRICTO del grupo de tarjetas (el que suma detalle.totalTarjetas).
  // 100% data-driven (config `grupos_metodo_pago` + `porGrupo`), sin nombres hardcodeados.
  const subtotalesTarjeta = React.useMemo(() => {
    const parent = grupos.find(
      (g) =>
        (g.formasPago?.length ?? 0) > 0 &&
        (reporte.porGrupo[g.clave] ?? null) === reporte.detalle.totalTarjetas,
    );
    if (!parent) return [];
    const parentFormas = new Set(parent.formasPago ?? []);
    return grupos
      .filter(
        (g) =>
          g.clave !== parent.clave &&
          (g.formasPago?.length ?? 0) > 0 &&
          (g.formasPago ?? []).every((f) => parentFormas.has(f)),
      )
      .map((g) => ({
        clave: g.clave,
        labelKey: g.labelKey,
        nombre: g.nombre,
        monto: reporte.porGrupo[g.clave] ?? 0,
      }))
      .filter((s) => s.monto !== 0);
  }, [grupos, reporte]);
  // Opciones del selector: roster completo del BE (gerencia ve todos, cajero solo a sí mismo).
  // Fallback si el roster viene vacío: "yo" + quienes facturaron ese día.
  const opcionesCajero: Array<{ usuarioId: string; nombre: string }> =
    cajeros.length > 0
      ? cajeros.map((c) => ({ usuarioId: c.usuarioId, nombre: c.nombre }))
      : [
          ...(meId ? [{ usuarioId: meId, nombre: t("scope.mine") }] : []),
          ...porCajero
            .filter((c): c is { usuarioId: string; nombre: string | null; total: number } =>
              !!c.usuarioId && c.usuarioId !== meId,
            )
            .map((c) => ({ usuarioId: c.usuarioId, nombre: c.nombre ?? c.usuarioId.slice(0, 8) })),
        ];

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
    ? t("count.consolidatedHint")
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
              {opcionesCajero.map((c) => (
                <SelectItem key={c.usuarioId} value={`user:${c.usuarioId}`}>
                  {c.usuarioId === meId ? `${c.nombre} · ${t("scope.mine")}` : c.nombre}
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
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] px-4 py-3">
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
          subtotalesTarjeta={subtotalesTarjeta}
          ventas={reporte.ventas}
          devoluciones={reporte.devoluciones}
          inicio={inicio}
          salesCash={salesCash}
          contado={contado}
          aDepositar={aDepositar}
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

      {/* Pie del cuadre para contabilidad: documentos del día + bloque tributario + hoja impresa firmable.
          En el consolidado los números del resumen son la UNIÓN de cajeros; el detalle/tributario del BE
          es del reporte del día (mismos filtros: división + centro). Handoff HANDOFF-pie-del-cuadre. */}
      <CuadreDetalle
        division={division}
        fecha={fecha}
        centroNombre={centroNombre}
        reporte={reporte}
        resumen={{
          inicio,
          salesCash,
          electronicas: reporte.detalle.totalElectronicas,
          totalTarjetas: reporte.detalle.totalTarjetas,
          totalDia: reporte.detalle.total,
          bruto: reporte.ventas.bruto,
          devuelto: reporte.devoluciones.total,
          neto: reporte.ventas.neto,
          contado,
          aDepositar,
          diferencia,
        }}
      />
    </div>
  );
}
