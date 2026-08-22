"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getPlanificacionCompras,
  actualizarItemOrden,
  actualizarNumeroOrden,
  crearOrdenCompra,
  cancelarOrden,
  type PlanificacionCompras,
  type PlanParams,
} from "@/lib/api/compras";
import { listProveedores, listAlmacenes, type Proveedor, type Almacen } from "@/lib/api/inventario";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { apiErrorLabel } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const nfmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const n = (v: number) => nfmt.format(Number(v) || 0);

// Planificación de compras (gerencia): existencias de TODOS los centros + PO abiertas como columnas
// dinámicas + recomendación de cuánto pedir. Las columnas derivadas las calcula el BACKEND (no se
// recalculan aquí); las de centro/PO salen de los arreglos del endpoint (crecen solas). Handoff
// planificacion-compras-handoff-be-listo. Análisis del legado: docs/plans/pedidos-planificacion-compras-analisis.md
export function PlanificacionCompras() {
  const t = useTranslations("compras");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();

  // Parámetros: borrador (editable) vs aplicados (los que dispara la consulta).
  const [meses, setMeses] = React.useState("3");
  const [c1, setC1] = React.useState("2.5");
  const [c2, setC2] = React.useState("2");
  const [desde, setDesde] = React.useState("");
  const [aplicados, setAplicados] = React.useState<PlanParams>({});

  const res = useResource<PlanificacionCompras>(
    () => getPlanificacionCompras(aplicados),
    [aplicados],
  );

  // Convertir la recomendación en ORDEN. El BE exige proveedor + almacén → se piden explícitos (sin
  // asumir). El nº de la orden es opcional (se puede fijar/editar después en la columna de la PO).
  const proveedoresRes = useResource<Proveedor[]>(() => listProveedores());
  const almacenesRes = useResource<Almacen[]>(() => listAlmacenes());
  const proveedores = proveedoresRes.state.kind === "ok" ? proveedoresRes.state.data : [];
  const almacenes = almacenesRes.state.kind === "ok" ? almacenesRes.state.data : [];
  const [proveedorId, setProveedorId] = React.useState("");
  const [almacenId, setAlmacenId] = React.useState("");
  const [nuevoNumero, setNuevoNumero] = React.useState("");
  const [creando, setCreando] = React.useState(false);

  if (!can("compras.planificar")) {
    return <div className="w-full px-6 py-16 text-center text-sm text-muted-foreground">{tc("forbidden")}</div>;
  }

  function aplicar() {
    setAplicados({
      meses: Number(meses) || undefined,
      criterio1: Number(c1) || undefined,
      criterio2: Number(c2) || undefined,
      desde: desde || undefined,
    });
  }

  const data = res.state.kind === "ok" ? res.state.data : null;
  const centros = data?.centros ?? [];
  const pos = data?.posAbiertas ?? [];

  // Editar cantidad de una PO (0 = quitar) → guarda y refresca para recomputar total/meses.
  async function editarCantidad(poId: string, productoId: string, valor: string, original: number) {
    const cantidad = Number(valor);
    if (!Number.isFinite(cantidad) || cantidad === original) return;
    try {
      await actualizarItemOrden(poId, { productoId, cantidad });
      toast.success(t("guardado"));
      res.reload();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
      res.reload();
    }
  }
  async function editarNumero(poId: string, valor: string, original: string) {
    const numero = valor.trim();
    if (!numero || numero === original) return;
    try {
      await actualizarNumeroOrden(poId, numero);
      toast.success(t("guardado"));
      res.reload();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
      res.reload();
    }
  }

  // Recomendados = los que hay que pedir (pedir>0). Redondeado = Pedido Red.; manual = Nuevo Pedido (crudo).
  const recomendados = (data?.productos ?? []).filter((p) => p.pedir > 0);
  async function crear(modo: "redondeado" | "manual") {
    if (!proveedorId || !almacenId) {
      toast.error(t("faltaProvAlm"));
      return;
    }
    const lineas = recomendados
      .map((p) => ({ productoId: p.productoId, cantidad: modo === "manual" ? p.nuevoPedido : p.pedidoRedondeado }))
      .filter((l) => l.cantidad > 0);
    if (lineas.length === 0) {
      toast.warning(t("nadaQuePedir"));
      return;
    }
    setCreando(true);
    try {
      const orden = await crearOrdenCompra({ proveedorId, almacenId, lineas });
      // El nº ante el proveedor es aparte (PUT numero); si lo escribieron, se fija ahora.
      if (nuevoNumero.trim() && orden?.id) {
        try {
          await actualizarNumeroOrden(orden.id, nuevoNumero.trim());
        } catch {
          /* la orden ya se creó; el nº se puede fijar luego en su columna */
        }
      }
      toast.success(t("ordenCreada", { n: lineas.length }));
      setNuevoNumero("");
      res.reload();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setCreando(false);
    }
  }

  async function cancelar(poId: string, numero: string | null) {
    if (!window.confirm(t("cancelarConfirm", { n: numero ?? poId.slice(0, 8) }))) return;
    try {
      await cancelarOrden(poId);
      toast.success(t("ordenCancelada"));
      res.reload();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    }
  }

  // Filas planas para imprimir/exportar (mismas columnas que la tabla, resueltas).
  function filasPlanas(): { headers: string[]; rows: (string | number)[][] } {
    const headers = [
      t("col.producto"),
      ...centros.map((c) => c.nombre),
      t("col.invTotal"),
      ...pos.map((po) => `PO ${po.numero ?? ""}`.trim()),
      t("col.ventas"), t("col.promedio"), t("col.total"), t("col.meses"), t("col.pedir"), t("col.nuevoPedido"), t("col.pedidoRed"),
    ];
    const rows = (data?.productos ?? []).map((p) => [
      p.nombre,
      ...centros.map((c) => p.existencias?.[c.clinicId] ?? 0),
      p.invTotal,
      ...pos.map((po) => p.poCantidades?.[po.id] ?? 0),
      p.ventasDelPeriodo, p.promedio, p.total, p.meses, p.pedir, p.nuevoPedido, p.pedidoRedondeado,
    ]);
    return { headers, rows };
  }
  function exportarCsv() {
    const { headers, rows } = filasPlanas();
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "planificacion-compras.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function imprimir() {
    const { headers, rows } = filasPlanas();
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    const th = headers.map((h) => `<th>${h}</th>`).join("");
    const trs = rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? "l" : "r"}">${c}</td>`).join("")}</tr>`).join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${t("title")}</title>` +
        `<style>body{font-family:system-ui,Arial,sans-serif;font-size:11px;margin:16px}h1{font-size:15px}` +
        `table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:3px 6px}` +
        `th{background:#eee;text-align:right}th:first-child{text-align:left}td.r{text-align:right}td.l{text-align:left}` +
        `@page{size:landscape;margin:8mm}</style></head><body onload="window.print()">` +
        `<h1>${t("title")}</h1><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body></html>`,
    );
    w.document.close();
  }

  return (
    <div className="w-full px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={imprimir} disabled={!data}>{t("imprimir")}</Button>
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!data}>{t("exportar")}</Button>
        </div>
      </div>
      <p className="mb-4 mt-1 max-w-3xl text-sm text-muted-foreground">{t("help")}</p>

      {/* Parámetros (los edita la gerencia; sobrescriben la config solo para esta consulta) */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <Campo label={t("param.meses")}><Input className="w-20" inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value)} /></Campo>
        <Campo label={t("param.criterio1")}><Input className="w-20" inputMode="decimal" value={c1} onChange={(e) => setC1(e.target.value)} /></Campo>
        <Campo label={t("param.criterio2")}><Input className="w-20" inputMode="decimal" value={c2} onChange={(e) => setC2(e.target.value)} /></Campo>
        <Campo label={t("param.desde")}><Input className="w-[150px]" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
        <Button onClick={aplicar} disabled={res.state.kind === "loading"}>{t("aplicar")}</Button>
        <span className="text-xs text-muted-foreground">{t("paramHint")}</span>
      </div>

      {/* Convertir la recomendación en ORDEN. El BE exige proveedor + almacén → explícitos (sin asumir). */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <span className="mb-1.5 text-sm font-semibold">{t("crearTitulo")}</span>
        <Campo label={t("field.proveedor")}>
          <Select value={proveedorId} onValueChange={setProveedorId}>
            <SelectTrigger className="w-52"><SelectValue placeholder={t("field.selProveedor")} /></SelectTrigger>
            <SelectContent>
              {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label={t("field.almacen")}>
          <Select value={almacenId} onValueChange={setAlmacenId}>
            <SelectTrigger className="w-52"><SelectValue placeholder={t("field.selAlmacen")} /></SelectTrigger>
            <SelectContent>
              {almacenes.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label={t("field.numero")}>
          <Input className="w-36" value={nuevoNumero} onChange={(e) => setNuevoNumero(e.target.value)} placeholder={t("field.numeroPh")} />
        </Campo>
        <Button
          onClick={() => crear("redondeado")}
          disabled={creando || !proveedorId || !almacenId || recomendados.length === 0}
        >
          {creando ? t("creando") : t("okPedido", { n: recomendados.length })}
        </Button>
        <Button
          variant="outline"
          onClick={() => crear("manual")}
          disabled={creando || !proveedorId || !almacenId || recomendados.length === 0}
          title={t("okManualHint")}
        >
          {t("okManual")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("crearHint")}</span>
      </div>

      {res.state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
      {res.state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {res.state.message}
        </p>
      )}

      {data && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b text-right">
                <th className="sticky left-0 z-10 bg-muted/60 px-3 py-2 text-left font-semibold">{t("col.producto")}</th>
                {centros.map((c) => <th key={c.clinicId} className="px-3 py-2 font-semibold">{c.nombre}</th>)}
                <th className="px-3 py-2 font-semibold">{t("col.invTotal")}</th>
                {/* Columnas de PO: nº editable en el propio encabezado. */}
                {pos.map((po) => (
                  <th key={po.id} className="px-2 py-1 font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <Input
                        key={po.numero ?? po.id}
                        defaultValue={po.numero ?? ""}
                        onBlur={(e) => editarNumero(po.id, e.target.value, po.numero ?? "")}
                        className="h-7 w-20 text-right text-xs"
                        title={t("col.poNumero")}
                      />
                      <button
                        type="button"
                        onClick={() => cancelar(po.id, po.numero)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        title={t("cancelarPo")}
                        aria-label={t("cancelarPo")}
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 font-semibold" title={t("col.ventasHint")}>{t("col.ventas")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.promedio")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.total")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.meses")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.pedir")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.nuevoPedido")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.pedidoRed")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.productos.length === 0 && (
                <tr><td colSpan={centros.length + pos.length + 8} className="px-3 py-8 text-center text-muted-foreground">{t("vacio")}</td></tr>
              )}
              {data.productos.map((p) => (
                <tr key={p.productoId} className="text-right hover:bg-muted/30">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium">{p.nombre}</td>
                  {centros.map((c) => <td key={c.clinicId} className="px-3 py-2 tabular-nums">{n(p.existencias?.[c.clinicId] ?? 0)}</td>)}
                  <td className="px-3 py-2 font-semibold tabular-nums">{n(p.invTotal)}</td>
                  {pos.map((po) => (
                    <td key={po.id} className="px-2 py-1">
                      <Input
                        key={`${po.id}:${p.poCantidades?.[po.id] ?? 0}`}
                        type="number"
                        defaultValue={p.poCantidades?.[po.id] ?? 0}
                        onBlur={(e) => editarCantidad(po.id, p.productoId, e.target.value, p.poCantidades?.[po.id] ?? 0)}
                        className="h-7 w-20 text-right tabular-nums"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{n(p.ventasDelPeriodo)}</td>
                  <td className="px-3 py-2 tabular-nums">{n(p.promedio)}</td>
                  <td className="px-3 py-2 tabular-nums">{n(p.total)}</td>
                  <td className="px-3 py-2 tabular-nums">{n(p.meses)}</td>
                  <td className="px-3 py-2">
                    <span className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                      p.pedir >= 2 ? "bg-red-500/15 text-red-600 dark:text-red-400"
                        : p.pedir === 1 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-muted text-muted-foreground",
                    )}>{p.pedir}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{n(p.nuevoPedido)}</td>
                  <td className="px-3 py-2 font-bold tabular-nums text-primary">{n(p.pedidoRedondeado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
