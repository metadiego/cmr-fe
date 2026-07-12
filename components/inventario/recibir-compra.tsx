"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  listAlmacenes,
  listProveedores,
  listPresentacionesProveedor,
  recibirCompra,
  type Almacen,
  type Proveedor,
  type PresentacionProveedor,
  type RecibirCompraPayload,
} from "@/lib/api/inventario";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { apiErrorMessage } from "@/lib/api/errors";
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

export function RecibirCompra() {
  const t = useTranslations("inventario.compra");

  const almacenesRes = useResource<Almacen[]>(() => listAlmacenes());
  const proveedoresRes = useResource<Proveedor[]>(() => listProveedores());
  const almacenes = almacenesRes.state.kind === "ok" ? almacenesRes.state.data : [];
  const proveedores = proveedoresRes.state.kind === "ok" ? proveedoresRes.state.data : [];

  const [productoId, setProductoId] = React.useState("");
  const [presentacionId, setPresentacionId] = React.useState("");
  const [almacenId, setAlmacenId] = React.useState("");
  const [cantidad, setCantidad] = React.useState("");
  const [costo, setCosto] = React.useState("");
  const [numeroLote, setNumeroLote] = React.useState("");
  const [numeroFactura, setNumeroFactura] = React.useState("");
  const [fechaVenc, setFechaVenc] = React.useState("");
  const [proveedorId, setProveedorId] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // AMPs del producto seleccionado (opcional).
  const ampsRes = useResource<PresentacionProveedor[]>(
    () =>
      productoId
        ? listPresentacionesProveedor(productoId, { activo: true })
        : Promise.resolve([]),
    [productoId],
  );
  const amps = ampsRes.state.kind === "ok" ? ampsRes.state.data : [];
  const amp = amps.find((a) => a.id === presentacionId) ?? null;
  const factor = amp?.factorABase ?? null; // unidades base por empaque

  // Preview de conversión (solo si el AMP tiene factorABase). NO se pre-convierte: se
  // muestra el resultado que hará el BE (cantidad × factorABase).
  const cant = Number(cantidad) || 0;
  const cst = Number(costo) || 0;
  const baseQty = factor ? cant * factor : null;
  const costoBase = factor && factor > 0 ? cst / factor : null;

  const canSubmit = !!productoId && !!almacenId && cant > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: RecibirCompraPayload = {
        productoId,
        almacenId,
        cantidad: cant,
        ...(cst > 0 ? { costoUnitario: cst } : {}),
        ...(presentacionId && presentacionId !== NONE
          ? { presentacionProveedorId: presentacionId }
          : {}),
        ...(numeroLote.trim() ? { numeroLote: numeroLote.trim() } : {}),
        ...(numeroFactura.trim() ? { numeroFacturaCompra: numeroFactura.trim() } : {}),
        ...(fechaVenc ? { fechaVencimiento: fechaVenc } : {}),
        ...(proveedorId && proveedorId !== NONE ? { proveedorId } : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      };
      await recibirCompra(payload);
      toast.success(t("received"));
      // Reset lo específico de la compra; deja producto/almacén para cargar en serie.
      setCantidad("");
      setCosto("");
      setNumeroLote("");
      setNumeroFactura("");
      setFechaVenc("");
      setNotas("");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const empaques = !!factor; // se compra por empaque
  const cantLabel = empaques ? t("field.cantidadEmpaques") : t("field.cantidadBase");
  const costoLabel = empaques ? t("field.costoEmpaque") : t("field.costoBase");

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      <div className="space-y-5 rounded-xl border p-5">
        {/* Producto + AMP */}
        <Row label={t("field.producto")}>
          <ProductoPicker
            value={productoId}
            onChange={(id) => {
              setProductoId(id);
              setPresentacionId("");
            }}
            placeholder={t("field.selectProducto")}
          />
        </Row>

        {productoId && (
          <Row label={t("field.presentacion")} hint={t("field.presentacionHint")}>
            <Select
              value={presentacionId || NONE}
              onValueChange={(v) => setPresentacionId(v === NONE ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("field.sinAmp")}</SelectItem>
                {amps.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre}
                    {a.factorABase ? ` (×${a.factorABase})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        )}

        {/* Cantidad + costo */}
        <div className="grid grid-cols-2 gap-3">
          <Row label={cantLabel}>
            <Input
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="0"
            />
          </Row>
          <Row label={costoLabel}>
            <Input
              inputMode="decimal"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              placeholder="0.00"
            />
          </Row>
        </div>

        {/* Preview de conversión — cuando el AMP tiene factorABase */}
        {factor != null && cant > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium text-primary">
              {t("preview.entrada", { qty: baseQty ?? 0 })}
            </span>
            {costoBase != null && cst > 0 && (
              <span className="ml-2 text-muted-foreground">
                {t("preview.costo", { costo: money(costoBase) })}
              </span>
            )}
          </div>
        )}

        {/* Almacén + proveedor */}
        <div className="grid grid-cols-2 gap-3">
          <Row label={t("field.almacen")}>
            <Select value={almacenId} onValueChange={setAlmacenId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("field.selectAlmacen")} />
              </SelectTrigger>
              <SelectContent>
                {almacenes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("field.proveedor")}>
            <Select
              value={proveedorId || NONE}
              onValueChange={(v) => setProveedorId(v === NONE ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("field.none")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("field.none")}</SelectItem>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </div>

        {/* Lote + vencimiento + factura */}
        <div className="grid grid-cols-2 gap-3">
          <Row label={t("field.lote")}>
            <Input value={numeroLote} onChange={(e) => setNumeroLote(e.target.value)} />
          </Row>
          <Row label={t("field.vencimiento")}>
            <Input
              type="date"
              value={fechaVenc}
              onChange={(e) => setFechaVenc(e.target.value)}
            />
          </Row>
        </div>
        <Row label={t("field.factura")}>
          <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} />
        </Row>
        <Row label={t("field.notas")}>
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
        </Row>

        <div className="flex justify-end pt-1">
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {submitting ? t("receiving") : t("receive")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
