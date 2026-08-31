"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getStockResumen,
  getStockConsolidado,
  getStockDetalle,
  type StockResumenFila,
  type StockConsolidadoFila,
  type StockDetalleFila,
} from "@/lib/api/stock";
import { listAlmacenes, type Almacen } from "@/lib/api/inventario";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTable } from "@/components/ui/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Paginated } from "@/lib/api/types";
import { AjusteModal, type AjusteObjetivo } from "@/components/inventario/ajuste-modal";

const TODOS = "__todos__";
const nf = new Intl.NumberFormat("en-US");
function fmtFecha(iso?: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function StockPage() {
  const t = useTranslations("inventario.stock");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const gate = useCentroGate();

  const [vista, setVista] = React.useState<"centro" | "consolidado">("centro");
  // Centro elegido: "" (TODOS) solo válido en consolidado (admin combinado, sin X-Tenant-ID). Con un solo
  // centro (gerente), queda fijado a ese.
  const unico = gate.centros.length === 1 ? gate.centros[0].id : null;
  const [centroSelRaw, setCentroSelRaw] = React.useState<string>("");
  const centroSel = unico ?? centroSelRaw;
  // Regla del dueño ("que lo entienda un chico de 12"): al entrar YA se ve la tabla, sin elegir centro
  // antes. "Por centro" nace en un centro relleno (el activo o el primero visible), no en vacío; en
  // "Consolidado", vacío = todos los centros combinados. El usuario lo cambia después con el selector.
  const primerCentro = gate.centro || gate.centros[0]?.id || "";
  const centroCentro = centroSel || primerCentro; // centro EFECTIVO de la vista "Por centro" (nunca vacío)

  // Filtros (chips + buscador). q se aplica con debounce; el resto en el acto. Cambiar cualquiera → page 1.
  const [q, setQ] = React.useState("");
  const [qApplied, setQApplied] = React.useState("");
  const [soloNegativos, setSoloNegativos] = React.useState(false);
  const [soloPorVencer, setSoloPorVencer] = React.useState(false);
  const [almacenId, setAlmacenId] = React.useState("");
  // Existencia a una FECHA pasada (asOf): "¿cuánto había el día que cuadramos?". Vacío = hoy.
  const [asOf, setAsOf] = React.useState("");
  // Por defecto solo lo inventariable; incluir no-inventariables sirve para auditar negativos imposibles.
  const [incluirNI, setIncluirNI] = React.useState(false);
  const [page, setPage] = React.useState(1);
  // Clic en un producto → modal con su DESGLOSE (por almacén/lote y estado): explica dónde está y por qué
  // un negativo. (El historial Entró/Salió aún no lo sirve el BE; ver handoff.)
  const tAj = useTranslations("inventarioAjuste");
  const [detalleDe, setDetalleDe] = React.useState<{ productoId: string; nombre: string } | null>(null);
  // AJUSTAR: el botón vive en la fila donde se VE el descuadre — ahí es donde la persona lo nota, y que
  // el ajuste esté a un clic de ese número es la mitad del trabajo.
  // See cmr-be/docs/specs/ajuste-de-inventario-handoff-fe.md
  const [ajusteDe, setAjusteDe] = React.useState<AjusteObjetivo | null>(null);
  React.useEffect(() => {
    const h = setTimeout(() => { setQApplied(q); setPage(1); }, 350);
    return () => clearTimeout(h);
  }, [q]);
  const resetPage = () => setPage(1);

  // Almacenes del centro (para el filtro en "Por centro"). Usa el centro EFECTIVO (nunca vacío).
  const tenantCentro = centroCentro || undefined;
  const almacenesRes = useResource<Almacen[]>(
    () => (tenantCentro ? listAlmacenes(tenantCentro) : Promise.resolve([])),
    [tenantCentro],
  );
  const almacenes = almacenesRes.state.kind === "ok" ? almacenesRes.state.data : [];
  // Almacén EFECTIVO (derivado, sin efecto): si el almacén guardado no pertenece al centro actual (p. ej.
  // se cambió de Caguas a Bayamón), cae a "" (Todos). Evita el fallo de heredar el almacén de otro centro
  // → 0 filas, y que el chip quede en blanco filtrando en silencio. Cada centro tiene su propio almacén.
  const almacenValido = almacenId && almacenes.some((a) => a.id === almacenId) ? almacenId : "";

  // Datos de la vista activa.
  const resumenRes = useResource<Paginated<StockResumenFila>>(
    () =>
      vista === "centro" && tenantCentro
        ? getStockResumen({ q: qApplied, almacenId: almacenValido || undefined, soloNegativos, soloPorVencer, asOf: asOf || undefined, incluirNoInventariables: incluirNI, page, limit: 50 }, tenantCentro)
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 50 } }),
    [vista, tenantCentro, qApplied, almacenValido, soloNegativos, soloPorVencer, asOf, incluirNI, page],
  );
  const consolRes = useResource<Paginated<StockConsolidadoFila>>(
    () =>
      vista === "consolidado"
        ? getStockConsolidado({ q: qApplied, soloNegativos, asOf: asOf || undefined, incluirNoInventariables: incluirNI, page, limit: 50 }, centroSel === "" ? null : centroSel)
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 50 } }),
    [vista, centroSel, qApplied, soloNegativos, asOf, incluirNI, page],
  );

  const cargando = vista === "centro" ? resumenRes.state.kind === "loading" : consolRes.state.kind === "loading";
  const resumen = resumenRes.state.kind === "ok" ? resumenRes.state.data : null;
  const consol = consolRes.state.kind === "ok" ? consolRes.state.data : null;
  const total = vista === "centro" ? resumen?.pagination.total ?? 0 : consol?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  // Columnas del consolidado = claves de porCentro (crecen solas con un 3.er centro); nombre por catálogo.
  const colCentros = React.useMemo(() => {
    if (vista !== "consolidado" || !consol) return [];
    const keys = new Set<string>();
    consol.items.forEach((r) => Object.keys(r.porCentro ?? {}).forEach((k) => keys.add(k)));
    const orden = gate.centros.filter((c) => keys.has(c.id)).map((c) => ({ id: c.id, nombre: c.nombre }));
    keys.forEach((k) => { if (!orden.some((o) => o.id === k)) orden.push({ id: k, nombre: k.slice(0, 6) }); });
    return orden;
  }, [vista, consol, gate.centros]);

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        count={t("totalProductos", { n: nf.format(total) })}
        actions={
          <>
            <div className="inline-flex rounded-lg border p-0.5">
              {(["centro", "consolidado"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setVista(v); resetPage(); }}
                  className={"rounded-md px-3 py-1.5 text-sm font-medium transition-colors " + (vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {t(`vista.${v}`)}
                </button>
              ))}
            </div>
            {/* Selector de centro (admin). En consolidado, "Todos" = combinado. */}
            {gate.puedeCambiar && (
              <Select
                value={vista === "centro" ? centroCentro : (centroSel === "" ? TODOS : centroSel)}
                onValueChange={(v) => { setCentroSelRaw(v === TODOS ? "" : v); setAlmacenId(""); resetPage(); }}
              >
                <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vista === "consolidado" && <SelectItem value={TODOS}>{t("todosCentros")}</SelectItem>}
                  {gate.centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </>
        }
      />

      {/* Barra de filtros: buscador + chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("buscar")}
          className="h-9 w-full max-w-xs"
          aria-label={t("buscar")}
        />
        <Chip active={soloNegativos} onClick={() => { setSoloNegativos((s) => !s); resetPage(); }}>{t("soloNegativos")}</Chip>
        {vista === "centro" && (
          <Chip active={soloPorVencer} onClick={() => { setSoloPorVencer((s) => !s); resetPage(); }}>{t("vencePronto")}</Chip>
        )}
        {vista === "centro" && almacenes.length > 0 && (
          <Select value={almacenValido || TODOS} onValueChange={(v) => { setAlmacenId(v === TODOS ? "" : v); resetPage(); }}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder={t("almacen")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>{t("almacenTodos")}</SelectItem>
              {almacenes.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Chip active={incluirNI} onClick={() => { setIncluirNI((s) => !s); resetPage(); }}>{t("incluirNoInventariables")}</Chip>
        {/* Existencia a una fecha pasada (para cuadrar el día). Vacío = hoy. */}
        <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>{t("asOf")}</span>
          <Input
            type="date"
            value={asOf}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => { setAsOf(e.target.value); resetPage(); }}
            className="h-9 w-40"
            aria-label={t("asOf")}
          />
          {asOf && (
            <button type="button" onClick={() => { setAsOf(""); resetPage(); }} className="text-xs text-primary hover:underline">{t("asOfHoy")}</button>
          )}
        </label>
      </div>

      {gate.cargando ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : gate.sinCentro && vista === "centro" ? (
        <p className="text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : (
        <>
          {cargando && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
          {(vista === "centro" ? resumenRes.state.kind === "fail" : consolRes.state.kind === "fail") && (
            <Alert variant="destructive">
              <AlertDescription>{tc("error")}</AlertDescription>
            </Alert>
          )}

          {/* POR CENTRO */}
          {vista === "centro" && resumen && !cargando && (
            resumen.items.length === 0 ? (
              <Vacio texto={t("vacioCentro")} />
            ) : (
              <>
                {/* md+: tabla. La cabecera sale del BE; sin scroll lateral en pantallas normales. */}
                <DataTable className="hidden md:block">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>{t("col.producto")}</TableHead>
                      <TableHead>{t("col.almacen")}</TableHead>
                      <TableHead>{t("col.lote")}</TableHead>
                      <TableHead className="text-right">{t("col.cantidad")}</TableHead>
                      <TableHead className="text-right sr-only">{tAj("titulo")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumen.items.map((r, i) => (
                      <TableRow key={`${r.productoId}-${r.almacenId ?? ""}-${r.loteId ?? ""}-${i}`} className="cursor-pointer" onClick={() => setDetalleDe({ productoId: r.productoId, nombre: r.nombre ?? r.sku ?? "—" })}>
                        <TableCell className="whitespace-normal">
                          <span className="flex items-center gap-1.5">
                            <EstadoDot estado={r.estado} />
                            <span className="font-medium">{r.nombre ?? r.sku ?? "—"}</span>
                            {r.nombreTecnico && <span className="text-xs text-muted-foreground">· {r.nombreTecnico}</span>}
                          </span>
                          <span className="block text-xs text-muted-foreground">{r.sku}{r.modoDescarga ? ` · ${t(`modo.${r.modoDescarga}` as const)}` : ""}</span>
                          <Equivalencias items={r.equivalencias} t={t} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.almacenNombre ?? "—"}</TableCell>
                        <TableCell>
                          <Lote numero={r.numeroLote} fecha={r.fechaVencimiento} vencido={r.vencido} porVencer={r.porVencer} tVencido={t("vencido")} tPorVencer={t("porVencer")} />
                        </TableCell>
                        <TableCell className="text-right"><Cantidad valor={r.cantidad} negativo={r.negativo} unidad={r.unidadClave} /></TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAjusteDe({
                                productoId: r.productoId,
                                nombre: r.nombre ?? r.sku ?? "—",
                                almacenId: r.almacenId ?? null,
                                almacenNombre: r.almacenNombre ?? null,
                                stockActual: Number(r.cantidad) || 0,
                              });
                            }}
                          >
                            {tAj("boton")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
                {/* Móvil: cada fila es una TARJETA (nombre + cuánto hay grande a la derecha; almacén/lote debajo). */}
                <div className="space-y-2 md:hidden">
                  {resumen.items.map((r, i) => (
                    <div key={`m-${r.productoId}-${r.almacenId ?? ""}-${r.loteId ?? ""}-${i}`} className="cursor-pointer rounded-xl border p-3" onClick={() => setDetalleDe({ productoId: r.productoId, nombre: r.nombre ?? r.sku ?? "—" })}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5"><EstadoDot estado={r.estado} /><span className="truncate font-medium">{r.nombre ?? r.sku ?? "—"}</span></div>
                          <div className="truncate text-xs text-muted-foreground">{r.sku}{r.nombreTecnico ? ` · ${r.nombreTecnico}` : ""}</div>
                        </div>
                        <Cantidad valor={r.cantidad} negativo={r.negativo} unidad={r.unidadClave} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{r.almacenNombre ?? "—"}</span>
                        <Lote numero={r.numeroLote} fecha={r.fechaVencimiento} vencido={r.vencido} porVencer={r.porVencer} tVencido={t("vencido")} tPorVencer={t("porVencer")} />
                      </div>
                      <Equivalencias items={r.equivalencias} t={t} />
                    </div>
                  ))}
                </div>
              </>
            )
          )}

          {/* CONSOLIDADO */}
          {vista === "consolidado" && consol && !cargando && (
            consol.items.length === 0 ? (
              <Vacio texto={t("vacioConsolidado")} />
            ) : (
              <>
                <DataTable className="hidden md:block">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>{t("col.producto")}</TableHead>
                      {colCentros.map((c) => <TableHead key={c.id} className="text-right">{c.nombre}</TableHead>)}
                      <TableHead className="text-right">{t("col.total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consol.items.map((r) => (
                      <TableRow key={r.productoId} className="cursor-pointer" onClick={() => setDetalleDe({ productoId: r.productoId, nombre: r.nombre ?? r.sku ?? "—" })}>
                        <TableCell className="whitespace-normal">
                          <span className="font-medium">{r.nombre ?? r.sku ?? "—"}</span>
                          {r.nombreTecnico && <span className="ml-2 text-xs text-muted-foreground">· {r.nombreTecnico}</span>}
                          <span className="block text-xs text-muted-foreground">{r.sku}</span>
                        </TableCell>
                        {colCentros.map((c) => {
                          const v = r.porCentro?.[c.id] ?? 0;
                          return <TableCell key={c.id} className="text-right"><Cantidad valor={v} negativo={v < 0} /></TableCell>;
                        })}
                        <TableCell className="text-right"><Cantidad valor={r.total} negativo={r.negativo} bold /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
                {/* Móvil: tarjeta por producto con el Total grande y el desglose por centro debajo. */}
                <div className="space-y-2 md:hidden">
                  {consol.items.map((r) => (
                    <div key={`m-${r.productoId}`} className="cursor-pointer rounded-xl border p-3" onClick={() => setDetalleDe({ productoId: r.productoId, nombre: r.nombre ?? r.sku ?? "—" })}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.nombre ?? r.sku ?? "—"}</div>
                          <div className="truncate text-xs text-muted-foreground">{r.sku}{r.nombreTecnico ? ` · ${r.nombreTecnico}` : ""}</div>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{t("col.total")}</span>
                          <Cantidad valor={r.total} negativo={r.negativo} bold />
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {colCentros.map((c) => {
                          const v = r.porCentro?.[c.id] ?? 0;
                          return (
                            <span key={c.id}>
                              {c.nombre}: <span className={"tabular-nums " + (v < 0 ? "font-semibold text-destructive" : "text-foreground")}>{v}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          )}

          {/* Paginación */}
          {total > 50 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{tc("prev")}</Button>
              <span className="text-muted-foreground">{t("pagina", { page, total: totalPages })}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{tc("next")}</Button>
            </div>
          )}
        </>
      )}

      {detalleDe && (
        <DetalleModal producto={detalleDe} centro={tenantCentro} onClose={() => setDetalleDe(null)} />
      )}
      {ajusteDe && (
        <AjusteModal
          objetivo={ajusteDe}
          centro={tenantCentro}
          onClose={() => setAjusteDe(null)}
          onHecho={() => resumenRes.reload()}
        />
      )}
    </PageContainer>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={"rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " + (active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
    >
      {children}
    </button>
  );
}

// Números GRANDES y a la derecha (regla del dueño): se comparan de un vistazo; negativo en rojo, sin
// explicación. `bold` (el Total) va un punto mayor.
// La cifra NUNCA sola: se acompaña de la unidad (g/mg/ml/u). unidadClave puede venir null → sin sufijo
// (no inventar «u.»). Handoff visor-de-existencias.
function Cantidad({ valor, negativo, bold, unidad }: { valor: number; negativo: boolean; bold?: boolean; unidad?: string | null }) {
  return (
    <span className={"tabular-nums " + (bold ? "text-lg font-bold " : "text-base ") + (negativo ? "font-semibold text-destructive" : "")}>
      {nf.format(valor)}{unidad ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unidad}</span> : null}
    </span>
  );
}

// Semáforo YA resuelto por el BE (no recalcular). Punto de color solo cuando NO es normal — pintar medio
// catálogo el primer día enseña a ignorar el color. Handoff visor-de-existencias.
// Colores via tokens semánticos (no raw emerald/amber/red): rojo→destructive, amber→warning. Mismos
// estados/severidad que antes, solo cambia la fuente del color.
const ESTADO_COLOR: Record<string, string> = {
  negativo: "bg-destructive",
  vencido: "bg-destructive",
  por_vencer: "bg-warning",
  bajo_minimo: "bg-warning/70",
};
function EstadoDot({ estado }: { estado?: string | null }) {
  const c = estado ? ESTADO_COLOR[estado] : undefined;
  if (!c) return null;
  return <span className={"inline-block size-2 shrink-0 rounded-full " + c} aria-label={estado ?? ""} title={estado ?? ""} />;
}

// «Alcanza para N de X»: equivalencias ordenadas de menor a mayor dosis. Vacío = no es insumo (no pintar).
function Equivalencias({ items, t }: { items?: { nombre?: string | null; dosis?: number | null; rinde?: number | null }[]; t: (k: string) => string }) {
  const eq = (items ?? []).filter((e) => (e.rinde ?? 0) > 0);
  if (eq.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium">{t("col.alcanza")}</span>{" "}
      {eq.map((e, i) => (
        <span key={i}>{i > 0 ? " · " : ""}<span className="font-semibold text-foreground tabular-nums">{e.rinde}</span> {t("col.de")} {e.nombre ?? (e.dosis != null ? `${e.dosis}` : "?")}</span>
      ))}
    </p>
  );
}

function Lote({ numero, fecha, vencido, porVencer, tVencido, tPorVencer }: { numero?: string | null; fecha?: string | null; vencido: boolean; porVencer: boolean; tVencido: string; tPorVencer: string }) {
  if (!numero && !fecha) return <span className="text-muted-foreground">—</span>;
  const dot = vencido ? "bg-destructive" : porVencer ? "bg-warning" : "";
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot && <span className={"inline-block size-2 shrink-0 rounded-full " + dot} aria-hidden />}
      <span className="tabular-nums">{numero ?? "—"}</span>
      {fecha && <span className={"text-xs " + (vencido ? "text-destructive" : porVencer ? "text-warning-foreground" : "text-muted-foreground")}>{fmtFecha(fecha)}{vencido ? ` · ${tVencido}` : porVencer ? ` · ${tPorVencer}` : ""}</span>}
    </span>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">{texto}</p>;
}

// Clic en un producto → DESGLOSE: dónde está (almacén/lote) y en qué estado (físico, reservado,
// comprometido, dañado, disponible). Palabras normales, números grandes a la derecha (regla del dueño).
// NO es el historial Entró/Salió (el BE aún no lo sirve): un aviso lo dice sin código ni jerga.
function DetalleModal({
  producto,
  centro,
  onClose,
}: {
  producto: { productoId: string; nombre: string };
  centro?: string;
  onClose: () => void;
}) {
  const t = useTranslations("inventario.stock");
  const tc = useTranslations("common");
  const { state } = useResource<StockDetalleFila[]>(
    () => getStockDetalle(producto.productoId, centro),
    [producto.productoId, centro ?? ""],
  );
  const filas = state.kind === "ok" ? state.data : null;
  const error = state.kind === "fail" ? t("detalle.error") : null;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Columnas de estado: solo las que traiga algún dato (no ensuciar con ceros que no aplican).
  const cols: { key: keyof StockDetalleFila; label: string }[] = (
    [
      ["fisico", t("detalle.fisico")],
      ["reservado", t("detalle.reservado")],
      ["comprometido", t("detalle.comprometido")],
      ["dañado", t("detalle.danado")],
      ["disponible", t("detalle.disponible")],
    ] as const
  )
    .filter(([k]) => (filas ?? []).some((f) => typeof f[k] === "number"))
    .map(([key, label]) => ({ key, label }));

  const total = (filas ?? []).reduce((s, f) => s + (f.cantidad ?? 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("detalle.title")}</p>
            <h2 className="mt-0.5 text-lg font-semibold">{producto.nombre}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>{tc("close")}</Button>
        </div>

        <div className="p-5">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : filas === null ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">{tc("loading")}</p>
          ) : filas.length === 0 ? (
            <Vacio texto={t("detalle.vacio")} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("detalle.almacen")}</TableHead>
                    <TableHead>{t("detalle.lote")}</TableHead>
                    {cols.map((c) => (
                      <TableHead key={String(c.key)} className="text-right">{c.label}</TableHead>
                    ))}
                    <TableHead className="text-right">{t("detalle.cantidad")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f, i) => (
                    <TableRow key={`${f.almacenId ?? ""}-${f.loteId ?? ""}-${i}`}>
                      <TableCell>{f.almacenNombre ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{f.numeroLote ?? "—"}</TableCell>
                      {cols.map((c) => (
                        <TableCell key={String(c.key)} className="text-right tabular-nums">{nf.format(Number(f[c.key] ?? 0))}</TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Cantidad valor={f.cantidad} negativo={!!f.negativo || f.cantidad < 0} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold" colSpan={2 + cols.length}>{t("detalle.total")}</TableCell>
                    <TableCell className="text-right">
                      <Cantidad valor={total} negativo={total < 0} bold />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>

              <p className="mt-4 rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">{t("detalle.notaMovimientos")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
