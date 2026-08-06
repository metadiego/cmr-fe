"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { getFacturasTablero, getFacturasResumen, type FacturaTablero, type FacturasResumen } from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { FacturaRowActions } from "@/components/facturacion/factura-row-actions";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListToolbar } from "@/components/kit/list-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";
const ESTADOS = ["borrador", "emitida", "anulada", "devuelta_parcial", "devuelta_total"];
const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;
// Montos grandes de la barra de totales: en-US con separador de miles (negocio USA/PR).
const moneyBar = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
// Fecha LOCAL del navegador (Puerto Rico), no UTC: a las 20:00 PR ya es el día siguiente en UTC y la
// pantalla mostraría el día equivocado. getFullYear/Month/Date usan la zona del navegador.
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function EstadoBadge({ estado }: { estado: string }) {
  const t = useTranslations("facturacionList.estado");
  const tone =
    estado === "borrador"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : estado === "anulada" || estado.startsWith("devuelta")
        ? "bg-destructive/15 text-destructive"
        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  return <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + tone}>{t.has(estado) ? t(estado) : estado || "—"}</span>;
}

// Lista de facturas UNIFORME para General y Consultas (mismo motor de tablero del BE). Solo cambia el
// `contexto` y los enlaces/acciones específicos (Nueva venta/Consumo insumos = solo General; las de
// consulta se crean desde el AP-board). Reuso — sin lógica nueva. Handoff fe-facturacion-consultas-uniforme.
export function FacturasListView({ contexto }: { contexto: "general" | "consulta" }) {
  const esConsulta = contexto === "consulta";
  const t = useTranslations("facturacionList");
  const tRoot = useTranslations();
  const router = useRouter();
  const params = useSearchParams();

  // Abrir filtrando el DÍA DE HOY (fecha local): la caja se trabaja por el día, no por el histórico. Si la
  // URL ya trae un rango (el usuario lo cambió), se respeta. Handoff facturacion-filtro-dia-actual.
  const hoy = isoDay(new Date());
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [estado, setEstado] = React.useState(params.get("estado") ?? "");
  const [desde, setDesde] = React.useState(params.get("desde") ?? hoy);
  const [hasta, setHasta] = React.useState(params.get("hasta") ?? hoy);
  const rangoEsHoy = desde === hoy && hasta === hoy;

  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (estado) sp.set("estado", estado);
    if (desde) sp.set("desde", desde);
    if (hasta) sp.set("hasta", hasta);
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [q, estado, desde, hasta, router]);

  const gate = useCentroGate();
  const { state, reload } = useResource<FacturaTablero>(
    () =>
      gate.centro
        ? getFacturasTablero({ q, estado, desde, hasta, contexto }, gate.centro)
        : Promise.resolve({ columnas: [], filas: [] }),
    [q, estado, desde, hasta, gate.centro, contexto],
  );

  // Resumen del RANGO (total del servidor): mismos filtros que la lista. La lista pinta /facturas/tablero
  // (filas resueltas, sin resumen) → este es el único que trae importe/exentas/cobradas + total del rango.
  const resumenRes = useResource<FacturasResumen>(
    () =>
      gate.centro
        ? getFacturasResumen({ q, estado, desde, hasta, contexto }, gate.centro)
        : Promise.resolve({ importe: 0, exentas: 0, cobradas: 0, total: 0 }),
    [q, estado, desde, hasta, gate.centro, contexto],
  );
  const resumen = resumenRes.state.kind === "ok" ? resumenRes.state.data : null;

  const tablero = state.kind === "ok" ? state.data : null;
  const columnas = (tablero?.columnas ?? []).filter((c) => c.clave !== "fac_acciones");
  const filas = tablero?.filas ?? [];

  // Total de la PÁGINA: se suma de las filas que ya tenemos (no se le pide nada al BE). Exenta = la que
  // quedó en cero. Como /tablero hoy trae todo el rango sin paginar, página y rango suelen coincidir →
  // se muestra un solo total (repetir el mismo número confunde). Handoff facturación-totales.
  const paginaImporte = filas.reduce((acc, f) => acc + Number(f.fac_total ?? 0), 0);
  const paginaExentas = filas.filter((f) => Number(f.fac_total ?? 0) <= 0).length;
  const paginaCount = filas.length;
  // Etiqueta de "exentas" por pantalla: en consultas son cortesías; en general, 100% de descuento.
  const labelExentas = esConsulta ? t("totales.cortesias") : t("totales.cienDescuento");
  // ¿Página == rango? (sin resumen aún, o mismo conteo) → un solo total.
  const totalUnico = !resumen || paginaCount === resumen.total;
  const devolucionesHref = esConsulta ? "/consultas/devoluciones" : "/facturacion/devoluciones";
  const detalleHref = (fid: string) => `/facturacion/${fid}${gate.centro ? `?centro=${gate.centro}` : ""}`;

  function cell(clave: string, value: unknown) {
    if (clave === "fac_estado") return <EstadoBadge estado={String(value ?? "")} />;
    if (clave === "fac_total") return <span className="font-medium tabular-nums">{money(value)}</span>;
    if (clave === "fac_fecha") return <span className="tabular-nums">{formatFechaSolo(value) || "—"}</span>;
    if (clave === "fac_numero")
      return <span className="font-mono tabular-nums">{value != null && value !== "" ? String(value) : t("draft")}</span>;
    return <span>{value == null || value === "" ? "—" : String(value)}</span>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{esConsulta ? t("titleConsulta") : t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={devolucionesHref}>{t("devoluciones")}</Link>
          </Button>
          {!esConsulta && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/facturacion/reportes/consumo-insumos">{t("consumoInsumos")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/facturacion/general?nuevo=1${gate.centro ? `&centro=${gate.centro}` : ""}`}>{t("nuevaVenta")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {gate.cargando ? (
        <p className="mt-8 text-sm text-muted-foreground">{tRoot("common.loading")}</p>
      ) : gate.sinCentro ? (
        <p className="mt-8 text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : gate.necesitaPicker ? (
        <div className="mt-8 max-w-xl"><CentroPicker centros={gate.centros} onPick={gate.pick} /></div>
      ) : (
        <div className="mt-6 space-y-4">
          {gate.puedeCambiar && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {tRoot("facturacion.general.centroLabel")} <span className="font-medium text-foreground">{gate.centroNombre}</span>
              </span>
              <button type="button" onClick={gate.cambiarCentro} className="text-xs font-medium text-primary hover:underline">
                {tRoot("facturacion.general.cambiarCentro")}
              </button>
            </div>
          )}

          <ListToolbar search={q} onSearchChange={setQ} searchPlaceholder={t("searchPlaceholder")}>
            <Select value={estado || ALL} onValueChange={(v) => setEstado(v === ALL ? "" : v)}>
              <SelectTrigger size="sm" className="w-[170px]"><SelectValue placeholder={t("allStates")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allStates")}</SelectItem>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{t(`estado.${e}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label={t("from")} className="h-8 w-[150px]" />
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label={t("to")} className="h-8 w-[150px]" />
            {rangoEsHoy ? (
              // Se ve que está filtrando por hoy + atajo para ampliar a todas las fechas (no lista corta muda).
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {t("hoyChip", { fecha: formatFechaSolo(hoy) })}
                <button type="button" onClick={() => { setDesde(""); setHasta(""); }} className="hover:underline">{t("verTodo")}</button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => { setDesde(hoy); setHasta(hoy); }}
                className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                {t("hoyBtn")}
              </button>
            )}
          </ListToolbar>

          {/* Barra de totales: RANGO del servidor (meta.resumen) + PÁGINA sumada de las filas. Un solo
              total si coinciden; dos niveles si hay paginación (página ≠ rango). No resta devoluciones
              (regla contable del dueño: la devolución resta el día en que ocurre, no el mes facturado). */}
          {state.kind === "ok" && filas.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              {totalUnico ? (
                <>
                  <span className="font-semibold tabular-nums">{moneyBar.format(resumen?.importe ?? paginaImporte)}</span>
                  <span className="text-muted-foreground">
                    {t("totales.facturas", { n: resumen?.total ?? paginaCount })}
                    {" · "}
                    <span className="tabular-nums">{resumen?.exentas ?? paginaExentas}</span> {labelExentas}
                    {" · "}
                    <span className="tabular-nums">{resumen?.cobradas ?? (paginaCount - paginaExentas)}</span> {t("totales.cobradas")}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">{t("totales.pagina")}:</span>
                  <span className="font-medium tabular-nums">{moneyBar.format(paginaImporte)}</span>
                  <span className="text-muted-foreground tabular-nums">({paginaCount})</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{t("totales.rango")}:</span>
                  <span className="font-semibold tabular-nums">{moneyBar.format(resumen!.importe)}</span>
                  <span className="text-muted-foreground">
                    (<span className="tabular-nums">{resumen!.total}</span> {t("totales.facturasN")},{" "}
                    <span className="tabular-nums">{resumen!.exentas}</span> {labelExentas},{" "}
                    <span className="tabular-nums">{resumen!.cobradas}</span> {t("totales.cobradas")})
                  </span>
                </>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  {/* Ordinal: nº de línea (orden en que se ven), no un dato de la factura. */}
                  <th className="w-10 px-3 py-2 text-right font-semibold" aria-label={t("colNum")}>#</th>
                  {columnas.map((c) => (
                    <th key={c.clave} className="px-3 py-2 font-semibold">{tRoot(c.labelKey)}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold">{tRoot("fac.col.acciones")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.kind === "loading" && (
                  <tr><td colSpan={columnas.length + 2} className="px-3 py-8 text-center text-muted-foreground">{tRoot("common.loading")}</td></tr>
                )}
                {state.kind === "fail" && (
                  <tr><td colSpan={columnas.length + 2} className="px-3 py-8 text-center text-destructive">{tRoot("common.error")}</td></tr>
                )}
                {state.kind === "ok" && filas.length === 0 && (
                  <tr><td colSpan={columnas.length + 2} className="px-3 py-8 text-center text-muted-foreground">{rangoEsHoy ? t("emptyHoy") : t("empty")}</td></tr>
                )}
                {filas.map((f, i) => (
                  <tr key={f.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(detalleHref(f.id))}>
                    {/* Ordinal continuo (con paginación: (page-1)*limit + i + 1; hoy la lista es de una página). */}
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{i + 1}</td>
                    {columnas.map((c) => (
                      <td key={c.clave} className="px-3 py-2">{cell(c.clave, f[c.clave])}</td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <FacturaRowActions facturaId={f.id} estado={String(f.fac_estado ?? "")} centroId={gate.centro} onChanged={reload} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
