"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  abrirCuadreTotal,
  cerrarCuadreTotal,
  contarCuadreTotal,
  enviarCuadreTotalEmail,
  getDenominaciones,
  getGruposMetodoPago,
  getReporteCuadreTotal,
  type CuadreTotalDia,
  type Denominacion,
  type GrupoMetodoPago,
} from "@/lib/api/caja";
import { apiErrorMessage } from "@/lib/api/errors";
import { todayPR } from "@/lib/format/fecha";
import { toCsv } from "@/lib/caja/export";
import { subtotalesTarjeta as calcSubtotalesTarjeta } from "@/lib/caja/totales";
import {
  esSoloLecturaCuadreTotal,
  puedeContarCuadreTotal,
  puedeCerrarCuadreTotal,
  puedeVerCuadreTotal,
} from "@/lib/caja/cuadre-total";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { useCan } from "@/hooks/use-can";
import { useCuadreTotalAutosave } from "@/hooks/use-cuadre-total-autosave";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { ConteoDenominaciones } from "@/components/caja/conteo-denominaciones";
import { ResumenPagos } from "@/components/caja/resumen-pagos";
import { DesgloseCajeros } from "@/components/caja/desglose-cajeros";
import { CuadreDetalle } from "@/components/caja/cuadre-detalle";
import { CashEmailPanel } from "@/components/caja/cash-email-panel";
import { ComprobacionCuadreTotal } from "@/components/caja/comprobacion-cuadre-total";
import { CuadreCajaSkeleton } from "@/components/caja/cuadre-caja-skeleton";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Cuadre TOTAL del día (handoff cuadre-unico-del-dia, cmr-be #457): las dos divisiones, todos los
// cajeros, un solo conteo opcional, comprobado contra la suma de los dos cuadres individuales. Es la
// hoja para tesorería; NO reemplaza el cuadre por división/cajero (ese sigue en la pestaña «Cuadre de
// caja», sin cambios). Pestaña propia en Facturación general, gateada por `caja.read`+`caja.ver_todos`
// (ver facturacion-con-tabs.tsx) — este componente repite la comprobación por si se navega aquí
// directo por URL, no solo por confiar en que la pestaña esté oculta.
export function CuadreTotal() {
  const t = useTranslations("caja.cuadre_total");
  const tCaja = useTranslations("caja");
  const gate = useCentroGate();
  const { can } = useCan();

  const puedeVer = puedeVerCuadreTotal({ leer: can("caja.read"), verTodos: can("caja.ver_todos") });
  const puedeContar = puedeContarCuadreTotal({ crear: can("caja.create"), verTodos: can("caja.ver_todos") });
  const puedeCerrarPermiso = puedeCerrarCuadreTotal({ cerrar: can("caja.cerrar"), verTodos: can("caja.ver_todos") });
  // Mismo criterio de seguridad que el cuadre por división (caja.retroactivo): no es parte explícita
  // del handoff, pero las rutas de abrir/contar son las mismas en forma, y contar un día pasado sin
  // avisar es exactamente el tipo de error que esa regla ya existe para evitar.
  const puedeRetroactivo = can("caja.retroactivo");

  // `todayPR()`, NO `new Date().toISOString()`: esta última da el día en UTC, que ya es "mañana" en
  // Puerto Rico después de las 8pm AST (bug real, 05-nov-2026: a las 10:33pm AST mostraba el día 5
  // como "hoy" siendo el 4 todavía — ver lib/format/fecha.ts).
  const hoy = React.useMemo(() => todayPR(), []);
  const [fecha, setFecha] = React.useState(hoy);

  const loadingGate = gate.cargando;

  return (
    <PageContainer>
      <PageHeader title={t("titulo")} description={t("help")} />

      {!loadingGate && gate.sinCentro && (
        <p className="text-sm text-muted-foreground">{tCaja("sinCentro")}</p>
      )}
      {!loadingGate && gate.necesitaPicker && (
        <CentroPicker centros={gate.centros} onPick={gate.pick} />
      )}

      {!gate.sinCentro && !gate.necesitaPicker && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="cuadre-total-fecha" className="text-sm text-muted-foreground">
                {tCaja("date")}
              </Label>
              <DatePicker
                id="cuadre-total-fecha"
                value={fecha}
                max={hoy}
                onChange={(v) => setFecha(v || hoy)}
                className="h-9 w-40"
              />
            </div>
          </div>

          {!puedeVer ? null : loadingGate ? (
            <CuadreCajaSkeleton isGerencia esConsolidado={false} />
          ) : (
            <Loader
              key={`${gate.centro}:${fecha}`}
              fecha={fecha}
              esHoy={fecha === hoy}
              puedeContar={puedeContar}
              puedeCerrarPermiso={puedeCerrarPermiso}
              puedeRetroactivo={puedeRetroactivo}
              centroNombre={gate.centroNombre}
              centroId={gate.centro}
            />
          )}
        </>
      )}
    </PageContainer>
  );
}

type LoaderProps = {
  fecha: string;
  esHoy: boolean;
  puedeContar: boolean;
  puedeCerrarPermiso: boolean;
  puedeRetroactivo: boolean;
  centroNombre?: string;
  centroId?: string | null;
};

function Loader(props: LoaderProps) {
  const { fecha } = props;
  const bundle = useResource(async () => {
    const [reporte, denoms, grupos] = await Promise.all([
      getReporteCuadreTotal(fecha),
      getDenominaciones(),
      getGruposMetodoPago(),
    ]);
    return { reporte, denoms, grupos };
  }, [fecha]);

  if (bundle.state.kind === "loading") return <CuadreCajaSkeleton isGerencia esConsolidado={false} />;
  if (bundle.state.kind !== "ok") return <p className="text-sm text-destructive">{bundle.state.message}</p>;

  const { reporte, denoms, grupos } = bundle.state.data;
  return (
    <Editor
      key="editor"
      {...props}
      reporte={reporte}
      denoms={denoms}
      grupos={grupos}
      onReload={bundle.refresh}
    />
  );
}

function Editor({
  fecha,
  esHoy,
  puedeContar,
  puedeCerrarPermiso,
  puedeRetroactivo,
  centroNombre,
  centroId,
  reporte,
  denoms,
  grupos,
  onReload,
}: LoaderProps & {
  reporte: CuadreTotalDia;
  denoms: Denominacion[];
  grupos: GrupoMetodoPago[];
  onReload: () => void;
}) {
  const t = useTranslations("caja.cuadre_total");
  const tCaja = useTranslations("caja");

  const cerrado = esSoloLecturaCuadreTotal(reporte.dayReconciliation?.status);
  const [contandoUnico, setContandoUnico] = React.useState(reporte.dayReconciliation?.ownCount ?? false);
  // El conteo único NO es para "cuadrar" desde cero: los cajeros ya contaron el suyo al cerrar su
  // propia caja (consulta/general). `conteoEfectivo.lines` del BE ya viene UNIFICADO — la suma de
  // esos conteos, o el override del gerente si ya hizo uno (owner, 05-nov-2026) — así que se siembra
  // SIEMPRE de ahí, no solo cuando `ownCount` es true. Sin esto, la grilla se veía vacía apenas se
  // abría la pantalla aunque los cajeros ya hubieran contado, como si hubiera que repetir el trabajo.
  const [conteo, setConteo] = React.useState<Record<string, number>>(() => {
    const lines = reporte.conteoEfectivo?.lines ?? [];
    return Object.fromEntries(
      lines.filter((l): l is typeof l & { denominationId: string } => !!l.denominationId).map((l) => [l.denominationId, l.quantity]),
    );
  });
  const [procesando, setProcesando] = React.useState(false);

  const puedeContarDia = !cerrado && (esHoy || puedeRetroactivo) && puedeContar;
  const contarHabilitado = puedeContarDia && contandoUnico;
  const autosave = useCuadreTotalAutosave(contarHabilitado, fecha, conteo, onReload);

  const subtotalesTarjeta = React.useMemo(
    () => calcSubtotalesTarjeta(grupos, reporte.porGrupo, reporte.detalle.totalTarjetas),
    [grupos, reporte],
  );
  const porCajero = reporte.porCajero ?? [];

  async function volverASuma() {
    try {
      await autosave.flush();
      const abierto = await abrirCuadreTotal(fecha);
      await contarCuadreTotal(abierto.id, []);
      setContandoUnico(false);
      setConteo({});
      onReload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function procesarCierre() {
    setProcesando(true);
    try {
      await autosave.flush();
      const abierto = await abrirCuadreTotal(fecha);
      const lineas = Object.entries(conteo)
        .filter(([, c]) => c > 0)
        .map(([denominationId, quantity]) => ({ denominationId, quantity }));
      if (contandoUnico && lineas.length) await contarCuadreTotal(abierto.id, lineas);
      await cerrarCuadreTotal(abierto.id);
      toast.success(tCaja("closeConfirmOk"));
      onReload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setProcesando(false);
    }
  }

  function exportar() {
    const r = reporte;
    const rows: Array<Array<string | number>> = [
      [t("titulo"), fecha],
      [],
      [tCaja("payments.cards")],
      [tCaja("payments.type"), tCaja("payments.qty"), tCaja("payments.amount")],
      ...r.detalle.tarjetas.map((x) => [x.name, x.quantity, x.amount]),
      [tCaja("payments.totalCards"), "", r.detalle.totalTarjetas],
      [],
      [tCaja("payments.otherMethods")],
      ...r.detalle.otros.map((x) => [x.name, x.quantity, x.amount]),
      [],
      [tCaja("payments.general")],
      [tCaja("payments.salesCash"), r.detalle.efectivo.amount],
      [tCaja("payments.electronic"), r.detalle.totalElectronicas],
      [tCaja("payments.totalCMA"), r.detalle.total],
      [tCaja("payments.grossBilling"), r.sales.bruto],
      [tCaja("payments.returns"), r.refunds.total],
      [tCaja("payments.netBilling"), r.sales.neto],
      [tCaja("payments.cashInDrawer"), r.check.day.counted],
      [tCaja("summary.variance"), r.check.day.difference],
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuadre-total-${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(tCaja("exported"));
  }

  return (
    <div className="space-y-4">
      {cerrado && (
        <div>
          <Badge variant="secondary">{tCaja("status.cerrado")}</Badge>
        </div>
      )}
      {!reporte.dayReconciliation && (
        <p className="text-sm text-muted-foreground">{t("sinAbrir")}</p>
      )}

      <ComprobacionCuadreTotal check={reporte.check} ownCount={reporte.dayReconciliation?.ownCount ?? false} />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {puedeContarDia && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-4 py-2.5 ring-1 ring-foreground/10">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={contandoUnico ? "default" : "secondary"}>
                  {contandoUnico ? t("conteo_unico") : t("suma_cajeros")}
                </Badge>
              </div>
              {contandoUnico ? (
                <Button size="sm" variant="outline" onClick={() => void volverASuma()}>
                  {t("suma_cajeros")}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setContandoUnico(true)}>
                  {t("conteo_unico")}
                </Button>
              )}
            </div>
          )}

          <ConteoDenominaciones
            denominaciones={denoms}
            cantidades={conteo}
            disabled={!contarHabilitado}
            hint={!contandoUnico ? tCaja("count.consolidatedHint") : undefined}
            saveState={contarHabilitado ? autosave.state : "idle"}
            onChange={(id, cantidad) => setConteo((prev) => ({ ...prev, [id]: cantidad }))}
          />

          <DesgloseCajeros
            cajeros={porCajero}
            meId={null}
            activeUsuarioId={null}
            onPick={() => {}}
            showCash={false}
          />
        </div>

        <ResumenPagos
          detalle={reporte.detalle}
          subtotalesTarjeta={subtotalesTarjeta}
          ventas={reporte.sales}
          devoluciones={reporte.refunds}
          inicio={reporte.check.day.fund}
          salesCash={reporte.detalle.efectivo.amount}
          contado={reporte.check.day.counted}
          aDepositar={reporte.check.day.counted - reporte.check.day.fund}
          diferencia={reporte.check.day.difference}
          // `!dayReconciliation` solo dice que ESTA pantalla nunca se abrió — no que nadie contó.
          // Los cajeros ya cuentan al cerrar su propia caja (consulta/general); `conteoEfectivo` viene
          // UNIFICADO de ahí y puede traer datos reales aunque el cuadre total en sí nunca se haya
          // abierto. Bug real 05-nov-2026: con $70 ya contados por los cajeros, esto pintaba "Sin
          // contar" en rojo como si nadie hubiera hecho nada. `null` = de verdad nadie contó todavía
          // (mismo contrato que ReporteDia.conteoEfectivo, ver lib/api/caja.ts).
          sinContar={!reporte.conteoEfectivo}
          cerrado={cerrado}
          cerradoEn={null}
          canProcesar={!cerrado && puedeCerrarPermiso}
          procesando={procesando}
          onProcesar={procesarCierre}
          onExport={exportar}
          canEmail
          emailPanel={<CashEmailPanel centerId={centroId} send={(emails) => enviarCuadreTotalEmail(fecha, emails, centroId)} />}
        />
      </div>

      <CuadreDetalle
        titulo={t("tituloImpreso")}
        fecha={fecha}
        centroNombre={centroNombre}
        reporte={reporte}
        resumen={{
          inicio: reporte.check.day.fund,
          salesCash: reporte.detalle.efectivo.amount,
          electronicas: reporte.detalle.totalElectronicas,
          totalTarjetas: reporte.detalle.totalTarjetas,
          totalDia: reporte.detalle.total,
          bruto: reporte.sales.bruto,
          devuelto: reporte.refunds.total,
          neto: reporte.sales.neto,
          contado: reporte.check.day.counted,
          aDepositar: reporte.check.day.counted - reporte.check.day.fund,
          diferencia: reporte.check.day.difference,
        }}
      />
    </div>
  );
}
