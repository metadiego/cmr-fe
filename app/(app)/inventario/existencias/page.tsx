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
import type { Paginated } from "@/lib/api/types";

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
  const [detalleDe, setDetalleDe] = React.useState<{ productoId: string; nombre: string } | null>(null);
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
    <div className="w-full px-6 py-6">
      {/* Título + conmutador de vista */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
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
        <span className="ml-auto text-sm text-muted-foreground">{t("totalProductos", { n: nf.format(total) })}</span>
      </div>

      {/* Barra de filtros: buscador + chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{tc("error")}</p>
          )}

          {/* POR CENTRO */}
          {vista === "centro" && resumen && !cargando && (
            resumen.items.length === 0 ? (
              <Vacio texto={t("vacioCentro")} />
            ) : (
              <>
                {/* md+: tabla. La cabecera sale del BE; sin scroll lateral en pantallas normales. */}
                <div className="hidden overflow-x-auto rounded-xl border md:block">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">{t("col.producto")}</th>
                        <th className="px-3 py-2 font-semibold">{t("col.almacen")}</th>
                        <th className="px-3 py-2 font-semibold">{t("col.lote")}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t("col.cantidad")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {resumen.items.map((r, i) => (
                        <tr key={`${r.productoId}-${r.almacenId ?? ""}-${r.loteId ?? ""}-${i}`} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetalleDe({ productoId: r.productoId, nombre: r.nombre ?? r.sku ?? "—" })}>
                          <td className="px-3 py-2">
                            <span className="font-medium">{r.nombre ?? r.sku ?? "—"}</span>
                            {r.nombreTecnico && <span className="ml-2 text-xs text-muted-foreground">· {r.nombreTecnico}</span>}
                            <span className="block text-xs text-muted-foreground">{r.sku}{r.modoDescarga ? ` · ${t(`modo.${r.modoDescarga}` as const)}` : ""}</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{r.almacenNombre ?? "—"}</td>
                          <td className="px-3 py-2">
                            <Lote numero={r.numeroLote} fecha={r.fechaVencimiento} vencido={r.vencido} porVencer={r.porVencer} tVencido={t("vencido")} tPorVencer={t("porVencer")} />
                          </td>
                          <td className="px-3 py-2 text-right"><Cantidad valor={r.cantidad} negativo={r.negativo} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Móvil: cada fila es una TARJETA (nombre + cuánto hay grande a la derecha; almacén/lote debajo). */}
                <div className="space-y-2 md:hidden">
                  {resumen.items.map((r, i) => (
                    <div key={`m-${r.productoId}-${r.almacenId ?? ""}-${r.loteId ?? ""}-${i}`} className="cursor-pointer rounded-xl border p-3" onClick={() => setDetalleDe({ productoId: r.productoId, nombre: r.nombre ?? r.sku ?? "—" })}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.nombre ?? r.sku ?? "—"}</div>
                          <div className="truncate text-xs text-muted-foreground">{r.sku}{r.nombreTecnico ? ` · ${r.nombreTecnico}` : ""}</div>
                        </div>
                        <Cantidad valor={r.cantidad} negativo={r.negativo} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{r.almacenNombre ?? "—"}</span>
                        <Lote numero={r.numeroLote} fecha={r.fechaVencimiento} vencido={r.vencido} porVencer={r.porVencer} tVencido={t("vencido")} tPorVencer={t("porVencer")} />
                      </div>
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
                <div className="hidden overflow-x-auto rounded-xl border md:block">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">{t("col.producto")}</th>
                        {colCentros.map((c) => <th key={c.id} className="px-3 py-2 text-right font-semibold">{c.nombre}</th>)}
                        <th className="px-3 py-2 text-right font-semibold">{t("col.total")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {consol.items.map((r) => (
                        <tr key={r.productoId} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetalleDe({ productoId: r.productoId, nombre: r.nombre ?? r.sku ?? "—" })}>
                          <td className="px-3 py-2">
                            <span className="font-medium">{r.nombre ?? r.sku ?? "—"}</span>
                            {r.nombreTecnico && <span className="ml-2 text-xs text-muted-foreground">· {r.nombreTecnico}</span>}
                            <span className="block text-xs text-muted-foreground">{r.sku}</span>
                          </td>
                          {colCentros.map((c) => {
                            const v = r.porCentro?.[c.id] ?? 0;
                            return <td key={c.id} className="px-3 py-2 text-right"><Cantidad valor={v} negativo={v < 0} /></td>;
                          })}
                          <td className="px-3 py-2 text-right"><Cantidad valor={r.total} negativo={r.negativo} bold /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
    </div>
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
function Cantidad({ valor, negativo, bold }: { valor: number; negativo: boolean; bold?: boolean }) {
  return (
    <span className={"tabular-nums " + (bold ? "text-lg font-bold " : "text-base ") + (negativo ? "font-semibold text-destructive" : "")}>
      {valor}
    </span>
  );
}

function Lote({ numero, fecha, vencido, porVencer, tVencido, tPorVencer }: { numero?: string | null; fecha?: string | null; vencido: boolean; porVencer: boolean; tVencido: string; tPorVencer: string }) {
  if (!numero && !fecha) return <span className="text-muted-foreground">—</span>;
  const dot = vencido ? "bg-destructive" : porVencer ? "bg-amber-500" : "";
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot && <span className={"inline-block size-2 shrink-0 rounded-full " + dot} aria-hidden />}
      <span className="tabular-nums">{numero ?? "—"}</span>
      {fecha && <span className={"text-xs " + (vencido ? "text-destructive" : porVencer ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{fmtFecha(fecha)}{vencido ? ` · ${tVencido}` : porVencer ? ` · ${tPorVencer}` : ""}</span>}
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
            <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">{error}</p>
          ) : filas === null ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">{tc("loading")}</p>
          ) : filas.length === 0 ? (
            <Vacio texto={t("detalle.vacio")} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">{t("detalle.almacen")}</th>
                      <th className="py-2 pr-3 font-medium">{t("detalle.lote")}</th>
                      {cols.map((c) => (
                        <th key={String(c.key)} className="py-2 pl-3 text-right font-medium">{c.label}</th>
                      ))}
                      <th className="py-2 pl-3 text-right font-medium">{t("detalle.cantidad")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={`${f.almacenId ?? ""}-${f.loteId ?? ""}-${i}`} className="border-b last:border-0">
                        <td className="py-2 pr-3">{f.almacenNombre ?? "—"}</td>
                        <td className="py-2 pr-3 tabular-nums">{f.numeroLote ?? "—"}</td>
                        {cols.map((c) => (
                          <td key={String(c.key)} className="py-2 pl-3 text-right tabular-nums">{nf.format(Number(f[c.key] ?? 0))}</td>
                        ))}
                        <td className="py-2 pl-3 text-right">
                          <Cantidad valor={f.cantidad} negativo={!!f.negativo || f.cantidad < 0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2">
                      <td className="py-2 pr-3 font-semibold" colSpan={2 + cols.length}>{t("detalle.total")}</td>
                      <td className="py-2 pl-3 text-right">
                        <Cantidad valor={total} negativo={total < 0} bold />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="mt-4 rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">{t("detalle.notaMovimientos")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
