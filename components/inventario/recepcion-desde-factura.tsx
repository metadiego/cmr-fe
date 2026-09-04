"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  emparejarRecepcion,
  confirmarRecepcion,
  listProveedores,
  listAlmacenes,
  type Proveedor,
  type Almacen,
  type RecepcionLineaEmparejada,
  type RecepcionSugerencia,
} from "@/lib/api/inventario";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { useResource } from "@/hooks/use-resource";
import { apiErrorLabel } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/ui/page";

const NONE = "__none__";
const money = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Fila editable del emparejamiento: conserva SIEMPRE el `texto` original (es lo que aprende el alias).
interface Fila {
  texto: string;
  productoId: string;
  productoNombre: string;
  confirmado: boolean;
  origen?: string | null;
  sugerencias: RecepcionSugerencia[];
  cantidad: string;
  costo: string;
  lote: string;
  venc: string;
}

// Recibir compra DESDE el papel del proveedor: pegar el texto → emparejar (con sugerencias y confianza)
// → confirmar (almacén/proveedor/nº factura). Manda el texto original de cada línea para que la próxima
// compra de ese proveedor llegue resuelta sola. Handoff recepcion-desde-factura.
export function RecepcionDesdeFactura() {
  const t = useTranslations("recepcionFactura");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const proveedoresRes = useResource<Proveedor[]>(() => listProveedores());
  const almacenesRes = useResource<Almacen[]>(() => listAlmacenes());
  const proveedores = proveedoresRes.state.kind === "ok" ? proveedoresRes.state.data : [];
  const almacenes = almacenesRes.state.kind === "ok" ? almacenesRes.state.data : [];

  const [paso, setPaso] = React.useState<"captura" | "revisar" | "confirmar">("captura");
  const [proveedorId, setProveedorId] = React.useState("");
  const [texto, setTexto] = React.useState("");
  const [filas, setFilas] = React.useState<Fila[]>([]);
  const [conteo, setConteo] = React.useState({ listas: 0, porRevisar: 0 });
  const [busy, setBusy] = React.useState(false);

  // Cabecera de confirmación.
  const [almacenId, setAlmacenId] = React.useState("");
  const [numeroFactura, setNumeroFactura] = React.useState("");
  const [fecha, setFecha] = React.useState(hoyISO());
  const [notas, setNotas] = React.useState("");
  const [aprendidos, setAprendidos] = React.useState<number | null>(null);

  function aFila(l: RecepcionLineaEmparejada): Fila {
    const top = l.sugerencias?.[0];
    return {
      texto: l.texto,
      productoId: l.productId ?? "",
      productoNombre: l.confirmado && top ? top.name : "",
      confirmado: l.confirmado,
      origen: l.source,
      sugerencias: l.sugerencias ?? [],
      cantidad: l.quantity != null ? String(l.quantity) : "",
      costo: l.unitCost != null ? String(l.unitCost) : "",
      lote: l.lotNumber ?? "",
      venc: l.expirationDate ?? "",
    };
  }

  async function emparejar() {
    const lineas = texto.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((s) => ({ texto: s }));
    if (lineas.length === 0) {
      toast.warning(t("pegaTexto"));
      return;
    }
    setBusy(true);
    try {
      const r = await emparejarRecepcion(lineas, proveedorId || undefined);
      // Por-revisar primero (que no haya que buscarlas).
      const ord = [...r.lines].sort((a, b) => Number(a.confirmado) - Number(b.confirmado));
      setFilas(ord.map(aFila));
      setConteo({ listas: r.listas, porRevisar: r.porRevisar });
      setPaso("revisar");
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(false);
    }
  }

  const setFila = (i: number, patch: Partial<Fila>) =>
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const sinEmparejar = filas.filter((f) => !f.productoId).length;
  const totalCosto = filas.reduce((s, f) => s + (Number(f.cantidad) || 0) * (Number(f.costo) || 0), 0);

  async function confirmar() {
    if (!almacenId) {
      toast.error(t("faltaAlmacen"));
      return;
    }
    if (sinEmparejar > 0) {
      toast.error(t("faltaEmparejar", { n: sinEmparejar }));
      setPaso("revisar");
      return;
    }
    setBusy(true);
    try {
      const r = await confirmarRecepcion({
        warehouseId: almacenId,
        ...(proveedorId ? { supplierId: proveedorId } : {}),
        ...(numeroFactura.trim() ? { purchaseInvoiceNumber: numeroFactura.trim() } : {}),
        ...(fecha ? { effectiveDate: fecha } : {}),
        ...(notas.trim() ? { notes: notas.trim() } : {}),
        lines: filas.map((f) => ({
          productId: f.productoId,
          texto: f.texto, // ORIGINAL → se aprende como alias
          quantity: Number(f.cantidad) || 0,
          ...(Number(f.costo) > 0 ? { unitCost: Number(f.costo) } : {}),
          ...(f.lote.trim() ? { lotNumber: f.lote.trim() } : {}),
          ...(f.venc ? { expirationDate: f.venc } : {}),
        })),
      });
      setAprendidos(r.aliasAprendidos ?? 0);
      toast.success(t("recibido"));
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(false);
    }
  }

  function reiniciar() {
    setPaso("captura"); setTexto(""); setFilas([]); setConteo({ listas: 0, porRevisar: 0 });
    setNumeroFactura(""); setNotas(""); setAprendidos(null);
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />

      {aprendidos !== null && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <span className="font-medium">{t("okAprendidos", { n: aprendidos })}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={reiniciar}>{t("otraRecepcion")}</Button>
        </div>
      )}

      {aprendidos === null && paso === "captura" && (
        <div className="max-w-2xl space-y-4 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("field.proveedor")}</span>
            <Select value={proveedorId || NONE} onValueChange={(v) => setProveedorId(v === NONE ? "" : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("field.selProveedor")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("field.sinProveedor")}</SelectItem>
                {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">{t("proveedorHint")}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("field.texto")}</span>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} placeholder={t("field.textoPh")} />
          </label>
          <div className="flex justify-end">
            <Button onClick={emparejar} disabled={busy || !texto.trim()}>{busy ? t("emparejando") : t("emparejar")}</Button>
          </div>
        </div>
      )}

      {aprendidos === null && paso === "revisar" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{t("conteo", { listas: conteo.listas, porRevisar: conteo.porRevisar })}</span>
            {sinEmparejar > 0 && <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-medium text-warning-foreground">{t("faltan", { n: sinEmparejar })}</span>}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPaso("captura")}>{tc("back")}</Button>
              <Button size="sm" onClick={() => setPaso("confirmar")} disabled={filas.length === 0}>{t("continuar")}</Button>
            </div>
          </div>
          <div className="space-y-2">
            {filas.map((f, i) => (
              <div key={i} className={cn("rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]", !f.productoId && "bg-warning ring-warning/40")}>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                  {/* Texto del proveedor */}
                  <div className="lg:col-span-4">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("col.texto")}</div>
                    <div className="font-mono text-sm">{f.texto}</div>
                    {f.confirmado && <span className="mt-1 inline-block rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-success-foreground">{t(`origen.${f.origen ?? "alias"}`)}</span>}
                  </div>
                  {/* Producto: sugerencias + buscar */}
                  <div className="lg:col-span-4">
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t("col.producto")}</div>
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {f.sugerencias.slice(0, 3).map((s) => (
                        <button key={s.productId} type="button"
                          onClick={() => setFila(i, { productoId: s.productId, productoNombre: s.name })}
                          className={cn("rounded-full border px-2 py-0.5 text-xs", f.productoId === s.productId ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent/50")}>
                          {s.name} · {Math.round(s.confianza * 100)}%
                        </button>
                      ))}
                      {f.sugerencias.length === 0 && !f.productoId && <span className="text-xs text-muted-foreground">{t("sinSugerencias")}</span>}
                    </div>
                    <ProductoPicker
                      value={f.productoId}
                      onChange={(id, prod) => setFila(i, { productoId: id, productoNombre: prod?.name ?? "" })}
                      placeholder={t("buscarProducto")}
                    />
                    {f.productoNombre && <div className="mt-1 text-xs text-success-foreground">✓ {f.productoNombre}</div>}
                  </div>
                  {/* Cantidad / costo / lote / venc */}
                  <div className="grid grid-cols-2 gap-2 lg:col-span-4 lg:grid-cols-4">
                    <Campo label={t("col.cantidad")}><Input inputMode="decimal" value={f.cantidad} onChange={(e) => setFila(i, { cantidad: e.target.value })} /></Campo>
                    <Campo label={t("col.costo")}><Input inputMode="decimal" value={f.costo} onChange={(e) => setFila(i, { costo: e.target.value })} /></Campo>
                    <Campo label={t("col.lote")}><Input value={f.lote} onChange={(e) => setFila(i, { lote: e.target.value })} /></Campo>
                    <Campo label={t("col.venc")}><Input type="date" value={f.venc} onChange={(e) => setFila(i, { venc: e.target.value })} /></Campo>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {aprendidos === null && paso === "confirmar" && (
        <div className="max-w-2xl space-y-4 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <h2 className="text-sm font-semibold">{t("confirmarTitulo")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Campo label={t("field.almacen")}>
              <Select value={almacenId} onValueChange={setAlmacenId}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t("field.selAlmacen")} /></SelectTrigger>
                <SelectContent>{almacenes.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </Campo>
            <Campo label={t("field.proveedor")}>
              <Input value={proveedores.find((p) => p.id === proveedorId)?.name ?? t("field.sinProveedor")} disabled />
            </Campo>
            <Campo label={t("field.factura")}><Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="F-000" /></Campo>
            <Campo label={t("field.fecha")}><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
          </div>
          <Campo label={t("field.notas")}><Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} /></Campo>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span>{t("resumen", { n: filas.length })}</span>
            <span className="font-semibold tabular-nums">{money(totalCosto)}</span>
          </div>
          {sinEmparejar > 0 && <p className="text-xs text-destructive">{t("faltaEmparejar", { n: sinEmparejar })}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPaso("revisar")}>{tc("back")}</Button>
            <Button onClick={confirmar} disabled={busy || !almacenId || sinEmparejar > 0}>{busy ? t("recibiendo") : t("recibir")}</Button>
          </div>
        </div>
      )}
    </PageContainer>
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
