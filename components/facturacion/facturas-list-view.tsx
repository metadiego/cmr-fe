"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { getFacturasTablero, getFacturasResumen, editarCabeceraFactura, type FacturaTablero, type FacturaTableroColumna, type FacturaTableroFila, type FacturasResumen } from "@/lib/api/facturas";
import { getOpciones, type Opcion } from "@/lib/api/tablero";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { useActiveClinic } from "@/hooks/use-active-clinic";
import { LiveBadge } from "@/components/live-badge";
import { InvoiceLiveFeeds, useInvoiceLiveFeeds } from "@/components/facturacion/invoice-live-feeds";
import { FacturaRowActions } from "@/components/facturacion/factura-row-actions";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { TabsActions, useTabsActionsSlot } from "@/components/kit/tabs-actions-slot";
import { DataTable, TableEmpty, TableError } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { TableRowsSkeleton } from "@/components/kit/skeletons";
import { DEFAULT_INVOICE_COLUMNS, invoiceColumnShape } from "@/lib/facturacion/invoice-board-defaults";
import {
  clinicForNewSale,
  invoiceDetailHref,
  newSaleHref,
  optionsKey,
  rangeTotalScope,
  rowClinicIds,
} from "@/lib/facturacion/invoice-clinics";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const variant =
    estado === "borrador"
      ? "warning"
      : estado === "anulada" || estado.startsWith("devuelta")
        ? "destructive"
        : "success";
  return <Badge variant={variant}>{t.has(estado) ? t(estado) : estado || "—"}</Badge>;
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
  const inTabsBar = useTabsActionsSlot();

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

  // Every clinic where the person reads invoices, narrowed by the filter (clinic-read-scope). No screen
  // clinic any more: each row carries its own, and every action on a row runs in the ROW's clinic.
  const filter = useClinicFilter("factura.read");
  const readable = React.useMemo(() => filter.centers.map((c) => c.id), [filter.centers]);
  const { state, refresh } = useResource<FacturaTablero>(
    () => getFacturasTablero({ q, status: estado, from: desde, to: hasta, context: contexto }, filter.choice),
    [q, estado, desde, hasta, filter.choiceKey, contexto],
  );

  // Summary of the RANGE (server total): same filters and the same clinics as the list. The list paints
  // /invoices/board (resolved rows, no summary) → this is the only one with importe/exentas/cobradas.
  const resumenRes = useResource<FacturasResumen>(
    () => getFacturasResumen({ q, status: estado, from: desde, to: hasta, context: contexto }, filter.choice),
    [q, estado, desde, hasta, filter.choiceKey, contexto],
  );
  const resumen = resumenRes.state.kind === "ok" ? resumenRes.state.data : null;

  // Live: the BE publishes invoice events (issued, paid, …) on each clinic's SSE bus; we listen to every
  // clinic shown. Any event refreshes the list and its range total in place.
  const { refresh: refreshResumen } = resumenRes;
  const liveClinics = filter.choice ?? readable;
  const { live, onLive } = useInvoiceLiveFeeds(liveClinics);
  const onInvalidate = React.useCallback(() => {
    refresh();
    refreshResumen();
  }, [refresh, refreshResumen]);

  const tablero = state.kind === "ok" ? state.data : null;
  // The board's columns survive a filter change: while the new range loads, the header stays put and
  // only the body turns into skeleton rows.
  const [knownCols, setKnownCols] = React.useState<FacturaTableroColumna[] | null>(null);
  const freshCols = tablero ? tablero.columns : null;
  if (freshCols && freshCols !== knownCols) setKnownCols(freshCols);
  const rawCols = freshCols ?? knownCols;
  const columnas = (rawCols ?? []).filter((c) => c.clave !== "fac_acciones");
  const loading = state.kind === "loading";
  const filas = tablero?.rows ?? [];

  // Inline-editable columns (fac_medico/fac_usuario): the BE declares them select+editable with a
  // writeBinding. Their options (doctors, users) belong to a clinic, so they load once per column AND per
  // distinct clinic of the rows shown; a row's select offers its own clinic's options.
  const selectCols = columnas.filter((c) => c.tipo === "select" && c.editable);
  const selectKey = selectCols.map((c) => c.clave).join(",");
  const rowClinics = rowClinicIds(filas);
  const rowClinicsKey = rowClinics.join(",");
  const opcionesRes = useResource<Record<string, Opcion[]>>(
    async () => {
      if (selectCols.length === 0 || rowClinics.length === 0) return {};
      const pairs = rowClinics.flatMap((clinic) => selectCols.map((c) => [clinic, c.clave] as const));
      const entries = await Promise.all(
        pairs.map(async ([clinic, col]) => [optionsKey(clinic, col), await getOpciones("facturacion", col, clinic)] as const),
      );
      return Object.fromEntries(entries);
    },
    [selectKey, rowClinicsKey],
  );
  const opciones = opcionesRes.state.kind === "ok" ? opcionesRes.state.data : {};

  // Cell: editable select (doctor/user) through the right writer (PUT /invoices/:id/header) in the ROW's
  // clinic; the rest, display. stopPropagation so using the select does not open the detail.
  function renderCelda(col: FacturaTableroColumna, fila: FacturaTableroFila) {
    if (col.tipo === "select" && col.editable) {
      const clinic = fila.clinicId ?? undefined;
      return <SelectCelda col={col} fila={fila} opciones={opciones[optionsKey(clinic, col.clave)] ?? []} centro={clinic} onSaved={refresh} />;
    }
    return cell(col.clave, fila[col.clave]);
  }

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
  // The range total sums the clinics shown: say which (one by name, several by count) to whoever reads
  // more than one clinic.
  const totalScope = filter.showColumn ? rangeTotalScope(filter.choice, readable) : null;
  const totalScopeLabel = !totalScope
    ? null
    : totalScope.kind === "one"
      ? filter.nameOf(totalScope.clinicId)
      : t("totales.centros", { n: totalScope.count });

  // A new sale needs ONE clinic: the single ticked one, else the active one (top bar). Shown on the
  // button to whoever can bill in more than one clinic.
  const active = useActiveClinic();
  const saleClinic = clinicForNewSale(filter.choice, readable, active);
  const saleClinicName = filter.multiClinic && saleClinic ? filter.nameOf(saleClinic) : "";

  function cell(clave: string, value: unknown) {
    if (clave === "fac_estado") return <EstadoBadge estado={String(value ?? "")} />;
    if (clave === "fac_total") return <span className="font-medium tabular-nums">{money(value)}</span>;
    if (clave === "fac_fecha") return <span className="tabular-nums">{formatFechaSolo(value) || "—"}</span>;
    if (clave === "fac_numero")
      return <span className="font-mono tabular-nums">{value != null && value !== "" ? String(value) : t("draft")}</span>;
    return <span>{value == null || value === "" ? "—" : String(value)}</span>;
  }

  const headerActions = (
    <>
      {live && <LiveBadge label={t("live")} />}
      {!esConsulta && (
        <Button size="sm" asChild>
          <Link href={newSaleHref(saleClinic)}>{saleClinicName ? t("nuevaVentaEn", { centro: saleClinicName }) : t("nuevaVenta")}</Link>
        </Button>
      )}
    </>
  );

  const colCount = columnas.length + 2 + (filter.showColumn ? 1 : 0);

  return (
    <PageContainer>
      <InvoiceLiveFeeds clinicIds={liveClinics} onInvalidate={onInvalidate} onLive={onLive} />
      {/* Under the billing tabs, the actions go on the tab bar's row; anywhere else, in the header. */}
      {inTabsBar && <TabsActions>{headerActions}</TabsActions>}
      <PageHeader title={esConsulta ? t("titleConsulta") : t("title")} actions={inTabsBar ? undefined : headerActions} />

      {!filter.loading && filter.centers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : (
        <>
          <ListToolbar
            search={q}
            onSearchChange={setQ}
            searchPlaceholder={t("searchPlaceholder")}
          >
            <Select value={estado || ALL} onValueChange={(v) => setEstado(v === ALL ? "" : v)}>
              <SelectTrigger size="sm" className="w-[170px]"><SelectValue placeholder={t("allStates")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allStates")}</SelectItem>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{t(`estado.${e}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <DatePicker value={desde} onChange={setDesde} aria-label={t("from")} className="h-8 w-[150px]" clearable />
            <DatePicker value={hasta} onChange={setHasta} aria-label={t("to")} className="h-8 w-[150px]" clearable />
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
          {loading && (
            <div aria-hidden className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <Skeleton className="my-0.5 h-4 w-20" />
              <Skeleton className="my-0.5 h-4 w-72 max-w-full" />
            </div>
          )}
          {state.kind === "ok" && filas.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              {totalScopeLabel && <span className="font-medium text-muted-foreground">{totalScopeLabel}:</span>}
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

          <DataTable>
            <TableHeader>
              <TableRow>
                {/* Ordinal: nº de línea (orden en que se ven), no un dato de la factura. */}
                <TableHead className="w-10 text-right" aria-label={t("colNum")}>#</TableHead>
                {/* Before the board's first response, the standard columns' names (known in code), never bars. */}
                {(rawCols ? columnas : DEFAULT_INVOICE_COLUMNS).map((c) => (
                  <TableHead key={c.clave}>{tRoot(c.labelKey)}</TableHead>
                ))}
                {filter.showColumn && <TableHead>{t("colCentro")}</TableHead>}
                <TableHead className="text-right">{tRoot("fac.col.acciones")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRowsSkeleton
                  columns={[
                    "short",
                    ...(rawCols ? columnas : DEFAULT_INVOICE_COLUMNS).map((c) => invoiceColumnShape(c.clave)),
                    ...(filter.showColumn ? (["badge"] as const) : []),
                    "button",
                  ]}
                />
              )}
              {!loading && state.kind === "fail" && (
                <TableError colSpan={colCount}>{tRoot("common.error")}</TableError>
              )}
              {!loading && state.kind === "ok" && filas.length === 0 && (
                <TableEmpty colSpan={colCount}>{rangoEsHoy ? t("emptyHoy") : t("empty")}</TableEmpty>
              )}
              {!loading && filas.map((f, i) => (
                <TableRow key={f.id} className="cursor-pointer" onClick={() => router.push(invoiceDetailHref(f.id, f.clinicId))}>
                  {/* Ordinal continuo (con paginación: (page-1)*limit + i + 1; hoy la lista es de una página). */}
                  <TableCell className="text-right tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  {columnas.map((c) => (
                    <TableCell key={c.clave}>{renderCelda(c, f)}</TableCell>
                  ))}
                  {filter.showColumn && (
                    <TableCell>
                      <Badge variant="outline">{f.clinicName || filter.nameOf(f.clinicId) || "—"}</Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {/* Void, return, email, edit: in the invoice's OWN clinic. */}
                    <FacturaRowActions facturaId={f.id} estado={String(f.fac_estado ?? "")} centroId={f.clinicId ?? undefined} onChanged={refresh} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </>
      )}
    </PageContainer>
  );
}

// Select editable de una columna del tablero de facturas (médico / usuario). Lee el valor crudo de
// `<clave>__valor` (perfilId / medicoId) y escribe por PUT /facturas/:id/cabecera con el campo del
// writeBinding (factura.usuarioId → usuarioId). El BE valida permiso y existencia. Handoff usuario-de-la-factura.
function SelectCelda({
  col,
  fila,
  opciones,
  centro,
  onSaved,
}: {
  col: FacturaTableroColumna;
  fila: FacturaTableroFila;
  opciones: Opcion[];
  centro?: string;
  onSaved: () => void;
}) {
  const tRoot = useTranslations();
  const field = String(col.render?.writeBinding ?? "").split(".").pop() ?? "";
  const crudo = fila[`${col.clave}__valor`];
  const current = crudo == null ? "" : String(crudo);
  const display = fila[col.clave];
  const [busy, setBusy] = React.useState(false);

  async function change(v: string) {
    if (!field || v === current) return;
    setBusy(true);
    try {
      await editarCabeceraFactura(String(fila.id), { [field]: v } as never, centro);
      onSaved();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={current || undefined} onValueChange={change} disabled={busy || opciones.length === 0}>
        <SelectTrigger size="sm" className="h-8 min-w-[150px] border-transparent bg-transparent px-2 hover:bg-muted/60 focus:bg-background">
          <SelectValue placeholder={display == null || display === "" ? "—" : String(display)} />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
