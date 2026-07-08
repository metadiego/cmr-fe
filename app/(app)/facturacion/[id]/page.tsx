"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  getFactura,
  getCatalogoFacturacion,
  getFormasPago,
  agregarItem,
  actualizarItem,
  eliminarItem,
  setDescuentoGlobal,
  emitirFactura,
  registrarPago,
  type FacturaConItems,
  type Producto,
  type FormaPago,
} from "@/lib/api/facturas";
import { toastError } from "@/lib/api/errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

export default function FacturacionPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = String(params.id);
  const centro = search.get("centro") ?? undefined;

  const t = useTranslations("facturacion");
  const tRoot = useTranslations();

  const [factura, setFactura] = React.useState<FacturaConItems | null>(null);
  const [catalogo, setCatalogo] = React.useState<Producto[]>([]);
  const [formas, setFormas] = React.useState<FormaPago[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const refetch = React.useCallback(() => {
    return getFactura(id, centro)
      .then(setFactura)
      .catch((err) => toastError(err, tRoot));
  }, [id, centro, tRoot]);

  React.useEffect(() => {
    let active = true;
    Promise.all([getFactura(id, centro), getCatalogoFacturacion(centro), getFormasPago(centro)])
      .then(([f, c, fp]) => {
        if (!active) return;
        setFactura(f);
        setCatalogo(c);
        setFormas(fp);
      })
      .catch((err) => toastError(err, tRoot))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, centro, tRoot]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refetch();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="mx-auto max-w-5xl px-6 py-16 text-center text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (!factura) return <p className="mx-auto max-w-5xl px-6 py-16 text-center text-sm text-muted-foreground">{t("notFound")}</p>;

  const items = factura.items ?? [];
  const estado = String(factura.estado ?? "");
  const esBorrador = estado === "borrador";
  const paciente = [factura.paciente?.nombres, factura.paciente?.apellidos].filter(Boolean).join(" ");
  const saldo = n(factura.total) - n(factura.montoAbonado);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <Link href="/tablero/atencion" className="text-sm text-muted-foreground hover:text-foreground">← {t("back")}</Link>

      {/* Cabecera */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent px-5 py-4">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">{t("title")}</span>
          <h1 className="truncate text-xl font-semibold tracking-tight">{paciente || t("patient")}</h1>
          {factura.medico?.nombre && <p className="text-xs text-muted-foreground">{factura.medico.nombre}</p>}
        </div>
        <div className="flex items-center gap-2">
          {factura.numero != null && (
            <span className="rounded-md bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ring-1 ring-border">
              {factura.serie ? `${factura.serie}-` : "#"}{String(factura.numero)}
            </span>
          )}
          <EstadoBadge estado={estado} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* Líneas */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("items")}</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">{t("concept")}</th>
                  <th className="w-20 px-3 py-2 text-right font-semibold">{t("qty")}</th>
                  <th className="w-28 px-3 py-2 text-right font-semibold">{t("price")}</th>
                  <th className="w-28 px-3 py-2 text-right font-semibold">{t("lineTotal")}</th>
                  {esBorrador && <th className="w-10 px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t("noItems")}</td></tr>
                )}
                {items.map((it) => (
                  <ItemRow
                    key={`${it.id}:${n(it.cantidad)}:${n(it.precioUnitario)}`}
                    it={it}
                    editable={esBorrador && !busy}
                    onUpdate={(p) => run(() => actualizarItem(id, it.id, p, centro))}
                    onRemoveLabel={t("remove")}
                    onRemove={() => run(() => eliminarItem(id, it.id, centro))}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {esBorrador && (
            <AddItem catalogo={catalogo} disabled={busy} onAdd={(p) => run(() => agregarItem(id, p, centro))} />
          )}
        </section>

        {/* Resumen + acciones */}
        <aside className="space-y-4">
          <div className="space-y-2 rounded-xl border p-4">
            <Row label={t("subtotal")} value={money(factura.subtotal)} />
            <Row label={t("discount")} value={`- ${money(factura.descuento)}`} />
            <Row label={t("tax")} value={money(factura.impuesto)} />
            <div className="border-t pt-2">
              <Row label={t("total")} value={money(factura.total)} strong />
            </div>
            {n(factura.montoAbonado) > 0 && (
              <>
                <Row label={t("paid")} value={money(factura.montoAbonado)} />
                <Row label={t("balance")} value={money(saldo)} strong />
              </>
            )}
          </div>

          {esBorrador && (
            <DescuentoGlobal disabled={busy} onApply={(tipo, valor) => run(() => setDescuentoGlobal(id, { tipo, valor } as never, centro))} applyLabel={t("applyDiscount")} />
          )}

          {esBorrador ? (
            <Button className="w-full" disabled={busy || items.length === 0} onClick={() => run(() => emitirFactura(id, centro))}>
              {t("emit")}
            </Button>
          ) : (
            <Pago formas={formas} disabled={busy} saldo={saldo} onPay={(formaPagoId, monto) => run(() => registrarPago(id, { formaPagoId, monto } as never, centro))} />
          )}
        </aside>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const tone =
    estado === "borrador" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : estado === "anulada" ? "bg-destructive/15 text-destructive"
    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  const label = estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : "—";
  return <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + tone}>{label}</span>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={strong ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{label}</span>
      <span className={"tabular-nums " + (strong ? "text-base font-bold" : "text-sm")}>{value}</span>
    </div>
  );
}

function ItemRow({
  it,
  editable,
  onUpdate,
  onRemove,
  onRemoveLabel,
}: {
  it: { id: string; descripcion?: string | null; cantidad?: unknown; precioUnitario?: unknown; total?: unknown };
  editable: boolean;
  onUpdate: (p: { cantidad?: number; precioUnitario?: number }) => void;
  onRemove: () => void;
  onRemoveLabel: string;
}) {
  // Estado local inicializado de props; el padre remonta la fila (key con
  // cantidad/precio) tras refetch, así que no hace falta re-sincronizar por effect.
  const [cant, setCant] = React.useState(String(n(it.cantidad) || 1));
  const [precio, setPrecio] = React.useState(String(n(it.precioUnitario)));

  return (
    <tr>
      <td className="px-3 py-2">{it.descripcion ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        {editable ? (
          <Input value={cant} onChange={(e) => setCant(e.target.value)} onBlur={() => { const v = Math.max(1, Math.floor(Number(cant) || 1)); if (v !== n(it.cantidad)) onUpdate({ cantidad: v }); }} className="h-7 w-16 text-right tabular-nums" inputMode="numeric" />
        ) : (
          <span className="tabular-nums">{n(it.cantidad)}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {editable ? (
          <Input value={precio} onChange={(e) => setPrecio(e.target.value)} onBlur={() => { const v = Math.max(0, Number(precio) || 0); if (v !== n(it.precioUnitario)) onUpdate({ precioUnitario: v }); }} className="h-7 w-24 text-right tabular-nums" inputMode="decimal" />
        ) : (
          <span className="tabular-nums">{money(it.precioUnitario)}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-medium tabular-nums">{money(it.total)}</td>
      {editable && (
        <td className="px-3 py-2 text-right">
          <button type="button" onClick={onRemove} aria-label={onRemoveLabel} className="text-destructive hover:opacity-70">×</button>
        </td>
      )}
    </tr>
  );
}

function AddItem({ catalogo, disabled, onAdd }: { catalogo: Producto[]; disabled?: boolean; onAdd: (p: { productoId: string; descripcion: string; cantidad: number; precioUnitario: number; gravado?: boolean }) => void }) {
  const t = useTranslations("facturacion");
  const [prodId, setProdId] = React.useState("");
  const [cant, setCant] = React.useState("1");
  const [precio, setPrecio] = React.useState("");
  const prod = catalogo.find((p) => p.id === prodId);
  const canAdd = !!prodId && Number(precio) >= 0 && !disabled;

  function add() {
    if (!prod) return;
    onAdd({ productoId: prod.id, descripcion: prod.nombre, cantidad: Math.max(1, Math.floor(Number(cant) || 1)), precioUnitario: Math.max(0, Number(precio) || 0), gravado: (prod as { gravado?: boolean }).gravado });
    setProdId(""); setCant("1"); setPrecio("");
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("addItem")}</span>
        <Select value={prodId} onValueChange={setProdId}>
          <SelectTrigger className="w-full"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
          <SelectContent>
            {catalogo.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <Input value={cant} onChange={(e) => setCant(e.target.value)} className="h-9 w-16 text-right tabular-nums" inputMode="numeric" aria-label={t("qty")} />
      <Input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0.00" className="h-9 w-24 text-right tabular-nums" inputMode="decimal" aria-label={t("price")} />
      <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={add}>{t("add")}</Button>
    </div>
  );
}

function DescuentoGlobal({ disabled, onApply, applyLabel }: { disabled?: boolean; onApply: (tipo: string, valor: number) => void; applyLabel: string }) {
  const t = useTranslations("facturacion");
  const [tipo, setTipo] = React.useState("porcentaje");
  const [valor, setValor] = React.useState("");
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("globalDiscount")}</span>
      <div className="flex items-center gap-2">
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="porcentaje">%</SelectItem>
            <SelectItem value="monto">$</SelectItem>
          </SelectContent>
        </Select>
        <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" className="h-9 flex-1 text-right tabular-nums" inputMode="decimal" />
        <Button type="button" variant="outline" size="sm" disabled={disabled || valor === ""} onClick={() => onApply(tipo, Math.max(0, Number(valor) || 0))}>{applyLabel}</Button>
      </div>
    </div>
  );
}

function Pago({ formas, disabled, saldo, onPay }: { formas: FormaPago[]; disabled?: boolean; saldo: number; onPay: (formaPagoId: string, monto: number) => void }) {
  const t = useTranslations("facturacion");
  const [formaId, setFormaId] = React.useState("");
  const [monto, setMonto] = React.useState(saldo > 0 ? String(saldo.toFixed(2)) : "");
  const canPay = !!formaId && Number(monto) > 0 && !disabled;
  if (saldo <= 0) return <p className="rounded-xl border bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">{t("fullyPaid")}</p>;
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("payment")}</span>
      <Select value={formaId} onValueChange={setFormaId}>
        <SelectTrigger className="w-full"><SelectValue placeholder={t("payMethod")} /></SelectTrigger>
        <SelectContent>
          {formas.filter((f) => f.activo !== false).map((f) => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Input value={monto} onChange={(e) => setMonto(e.target.value)} className="h-9 flex-1 text-right tabular-nums" inputMode="decimal" />
        <Button type="button" disabled={!canPay} onClick={() => onPay(formaId, Math.max(0, Number(monto) || 0))}>{t("registerPayment")}</Button>
      </div>
    </div>
  );
}
