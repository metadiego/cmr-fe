"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import {
  listAlmacenes,
  listProveedores,
  recibirCompraLote,
  type Almacen,
  type Proveedor,
  type RecibirCompraLoteItem,
} from "@/lib/api/inventario";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";
const money = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Una línea del carrito (packing list). El mismo producto puede repetirse con lote/venc distintos.
interface Linea {
  key: number;
  productoId: string;
  productoNombre: string;
  cantidad: string;
  costo: string;
  numeroLote: string;
  fechaVencimiento: string;
}

// RECIBIR COMPRA POR PACKING LIST: cabecera común (almacén/proveedor/nº factura/fecha/notas) + carrito de
// líneas (producto, cantidad, costo, lote, vencimiento). Un solo «Recibir» manda todo (todo-o-nada).
// La cantidad va en la UNIDAD DE INVENTARIO (el endpoint por lote NO convierte por empaque). Handoff
// recepcion-packing-list. Usa todo el ancho: cabecera a un tercio, tabla de líneas al resto.
export function RecibirCompra() {
  const t = useTranslations("inventario.compra");
  const tRoot = useTranslations();

  const almacenesRes = useResource<Almacen[]>(() => listAlmacenes());
  const proveedoresRes = useResource<Proveedor[]>(() => listProveedores());
  const almacenes = almacenesRes.state.kind === "ok" ? almacenesRes.state.data : [];
  const proveedores = proveedoresRes.state.kind === "ok" ? proveedoresRes.state.data : [];

  // Cabecera común
  const [almacenId, setAlmacenId] = React.useState("");
  const [proveedorId, setProveedorId] = React.useState("");
  const [numeroFactura, setNumeroFactura] = React.useState("");
  const [fecha, setFecha] = React.useState(hoyISO());
  const [notas, setNotas] = React.useState("");

  // Línea en edición (para «Agregar»)
  const [pId, setPId] = React.useState("");
  const [pNombre, setPNombre] = React.useState("");
  const [cantidad, setCantidad] = React.useState("");
  const [costo, setCosto] = React.useState("");
  const [lote, setLote] = React.useState("");
  const [venc, setVenc] = React.useState("");

  const [lineas, setLineas] = React.useState<Linea[]>([]);
  const [keySeq, setKeySeq] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [reciboId, setReciboId] = React.useState<string | null>(null);

  const totalCosto = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.costo) || 0), 0);
  const puedeAgregar = !!pId && (Number(cantidad) || 0) > 0;

  function agregarLinea() {
    if (!puedeAgregar) return;
    setLineas((ls) => [
      ...ls,
      { key: keySeq, productoId: pId, productoNombre: pNombre || pId.slice(0, 8), cantidad, costo, numeroLote: lote, fechaVencimiento: venc },
    ]);
    setKeySeq((n) => n + 1);
    // Limpia la línea para la siguiente; deja proveedor/factura/almacén de la cabecera intactos.
    setPId(""); setPNombre(""); setCantidad(""); setCosto(""); setLote(""); setVenc("");
  }

  function quitar(key: number) {
    setLineas((ls) => ls.filter((l) => l.key !== key));
  }
  function editar(key: number, campo: "cantidad" | "costo", valor: string) {
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  async function recibir() {
    if (lineas.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const items: RecibirCompraLoteItem[] = lineas.map((l) => ({
        productoId: l.productoId,
        cantidad: Number(l.cantidad) || 0,
        ...(Number(l.costo) > 0 ? { costoUnitario: Number(l.costo) } : {}),
        ...(l.numeroLote.trim() ? { numeroLote: l.numeroLote.trim() } : {}),
        ...(l.fechaVencimiento ? { fechaVencimiento: l.fechaVencimiento } : {}),
      }));
      const r = await recibirCompraLote({
        ...(almacenId ? { almacenId } : {}),
        ...(proveedorId && proveedorId !== NONE ? { proveedorId } : {}),
        ...(numeroFactura.trim() ? { numeroFacturaCompra: numeroFactura.trim() } : {}),
        ...(fecha ? { fechaEfectiva: fecha } : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
        items,
      });
      setReciboId(r.documentoId ?? null);
      toast.success(t("received"));
      // Limpia el carrito; conserva la cabecera por si siguen cargando del mismo proveedor.
      setLineas([]);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-3xl text-sm text-muted-foreground">{t("helpLote")}</p>

      {reciboId && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 text-success" />
          <span className="font-medium">{t("reciboOk", { id: reciboId })}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setReciboId(null)}>
            {t("nuevaRecepcion")}
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Cabecera común (un tercio) */}
        <div className="space-y-4 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] lg:col-span-1">
          <h2 className="text-sm font-semibold">{t("cabecera")}</h2>
          <Row label={t("field.almacen")}>
            <Select value={almacenId} onValueChange={setAlmacenId}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("field.selectAlmacen")} /></SelectTrigger>
              <SelectContent>
                {almacenes.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("field.proveedor")}>
            <Select value={proveedorId || NONE} onValueChange={(v) => setProveedorId(v === NONE ? "" : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("field.none")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("field.none")}</SelectItem>
                {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label={t("field.factura")}>
              <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="F-000" />
            </Row>
            <Row label={t("field.fecha")}>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Row>
          </div>
          <Row label={t("field.notas")}>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </Row>
        </div>

        {/* Carrito de líneas (dos tercios) */}
        <div className="space-y-4 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] lg:col-span-2">
          <h2 className="text-sm font-semibold">{t("lineas")}</h2>

          {/* Agregar línea */}
          <div className="grid grid-cols-1 gap-2 rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] sm:grid-cols-12">
            <div className="sm:col-span-5">
              <ProductoPicker
                value={pId}
                onChange={(id, prod) => { setPId(id); setPNombre(prod?.nombre ?? ""); }}
                placeholder={t("field.selectProducto")}
              />
            </div>
            <Input className="sm:col-span-2" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder={t("field.cantidadBase")} />
            <Input className="sm:col-span-2" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder={t("field.costoBase")} />
            <Input className="sm:col-span-1" value={lote} onChange={(e) => setLote(e.target.value)} placeholder={t("field.lote")} />
            <Input className="sm:col-span-2" type="date" value={venc} onChange={(e) => setVenc(e.target.value)} title={t("field.vencimiento")} />
            <div className="sm:col-span-12 flex justify-end">
              <Button size="sm" variant="secondary" onClick={agregarLinea} disabled={!puedeAgregar}>
                <HugeiconsIcon icon={Add01Icon} className="size-4" /> {t("agregar")}
              </Button>
            </div>
          </div>

          {/* Tabla de líneas */}
          {lineas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("sinLineas")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t("field.producto")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("field.cantidadBase")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("field.costoBase")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("field.lote")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("field.vencimiento")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("subtotal")}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lineas.map((l) => (
                    <tr key={l.key}>
                      <td className="px-3 py-2">{l.productoNombre}</td>
                      <td className="px-2 py-1 text-right">
                        <Input inputMode="decimal" value={l.cantidad} onChange={(e) => editar(l.key, "cantidad", e.target.value)} className="h-8 w-20 text-right" />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <Input inputMode="decimal" value={l.costo} onChange={(e) => editar(l.key, "costo", e.target.value)} className="h-8 w-24 text-right" />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{l.numeroLote || "—"}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{l.fechaVencimiento || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money((Number(l.cantidad) || 0) * (Number(l.costo) || 0))}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => quitar(l.key)} className="text-muted-foreground hover:text-destructive" aria-label={t("quitar")}>
                          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/20 text-sm font-semibold">
                    <td className="px-3 py-2">{t("totalLineas", { n: lineas.length })}</td>
                    <td colSpan={4} />
                    <td className="px-3 py-2 text-right tabular-nums">{money(totalCosto)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button onClick={recibir} disabled={lineas.length === 0 || submitting}>
              {submitting ? t("receiving") : t("receive")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
