"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getStockResumen,
  getStockConsolidado,
  type StockResumenFila,
  type StockConsolidadoFila,
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

  // Filtros (chips + buscador). q se aplica con debounce; el resto en el acto. Cambiar cualquiera → page 1.
  const [q, setQ] = React.useState("");
  const [qApplied, setQApplied] = React.useState("");
  const [soloNegativos, setSoloNegativos] = React.useState(false);
  const [soloPorVencer, setSoloPorVencer] = React.useState(false);
  const [almacenId, setAlmacenId] = React.useState("");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => {
    const h = setTimeout(() => { setQApplied(q); setPage(1); }, 350);
    return () => clearTimeout(h);
  }, [q]);
  const resetPage = () => setPage(1);

  // Almacenes del centro (para el filtro en "Por centro").
  const tenantCentro = (centroSel && centroSel !== "" ? centroSel : gate.centro) || undefined;
  const almacenesRes = useResource<Almacen[]>(
    () => (tenantCentro ? listAlmacenes(tenantCentro) : Promise.resolve([])),
    [tenantCentro],
  );
  const almacenes = almacenesRes.state.kind === "ok" ? almacenesRes.state.data : [];

  // Datos de la vista activa.
  const resumenRes = useResource<Paginated<StockResumenFila>>(
    () =>
      vista === "centro" && tenantCentro
        ? getStockResumen({ q: qApplied, almacenId: almacenId || undefined, soloNegativos, soloPorVencer, page, limit: 50 }, tenantCentro)
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 50 } }),
    [vista, tenantCentro, qApplied, almacenId, soloNegativos, soloPorVencer, page],
  );
  const consolRes = useResource<Paginated<StockConsolidadoFila>>(
    () =>
      vista === "consolidado"
        ? getStockConsolidado({ q: qApplied, soloNegativos, page, limit: 50 }, centroSel === "" ? null : centroSel)
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 50 } }),
    [vista, centroSel, qApplied, soloNegativos, page],
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
            value={centroSel === "" ? TODOS : centroSel}
            onValueChange={(v) => { setCentroSelRaw(v === TODOS ? "" : v); resetPage(); }}
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
          <Select value={almacenId || TODOS} onValueChange={(v) => { setAlmacenId(v === TODOS ? "" : v); resetPage(); }}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder={t("almacen")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>{t("almacenTodos")}</SelectItem>
              {almacenes.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
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
              <div className="overflow-x-auto rounded-xl border">
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
                      <tr key={`${r.productoId}-${r.almacenId ?? ""}-${r.loteId ?? ""}-${i}`} className="hover:bg-muted/30">
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
            )
          )}

          {/* CONSOLIDADO */}
          {vista === "consolidado" && consol && !cargando && (
            consol.items.length === 0 ? (
              <Vacio texto={t("vacioConsolidado")} />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
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
                      <tr key={r.productoId} className="hover:bg-muted/30">
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

function Cantidad({ valor, negativo, bold }: { valor: number; negativo: boolean; bold?: boolean }) {
  return (
    <span className={"tabular-nums " + (negativo ? "font-semibold text-destructive" : bold ? "font-bold" : "")}>
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
