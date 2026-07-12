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
  type FacturaItem,
  type Producto,
  type FormaPago,
} from "@/lib/api/facturas";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import { toastError } from "@/lib/api/errors";
import { buildRecibo } from "@/lib/factura/build-recibo";
import { ReciboTermico } from "@/components/facturacion/recibo-termico";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon } from "@hugeicons/core-free-icons";
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
  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
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
    // La factura primero: si es de CONSULTA (tiene citaId) el catálogo se pide con contexto=consulta
    // (solo Consulta/Seguimiento); una factura de venta pide el catálogo completo.
    getFactura(id, centro)
      .then((f) =>
        Promise.all([
          Promise.resolve(f),
          getCatalogoFacturacion(centro, f.citaId ? "consulta" : undefined),
          getFormasPago(centro),
        ]),
      )
      .then(([f, c, fp]) => {
        if (!active) return;
        setFactura(f);
        setCatalogo(c);
        setFormas(fp);
        if (f.pacienteId) {
          getPaciente(String(f.pacienteId), centro).then((p) => active && setPaciente(p)).catch(() => {});
        }
      })
      .catch((err) => toastError(err, tRoot))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, centro, tRoot]);

  const run = React.useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        await refetch();
      } catch (err) {
        toastError(err, tRoot);
      } finally {
        setBusy(false);
      }
    },
    [refetch, tRoot],
  );

  if (loading) return <p className="mx-auto max-w-5xl px-6 py-16 text-center text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (!factura) return <p className="mx-auto max-w-5xl px-6 py-16 text-center text-sm text-muted-foreground">{t("notFound")}</p>;

  const estado = String(factura.estado ?? "");
  const nombre = paciente ? [paciente.nombres, paciente.apellidos].filter(Boolean).join(" ") : "";
  const record = paciente?.record ?? "";
  // El recibo se arma 100% de la proyección enriquecida del BE (empresa/pagos/
  // emisor/medico/numeroDisplay/paciente) — sin fallbacks del FE.
  const recibo = buildRecibo(factura);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <Link href="/tablero/atencion" className="text-sm text-muted-foreground hover:text-foreground">← {t("back")}</Link>

      {/* Cabecera */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent px-5 py-4">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">{t("title")}</span>
          <h1 className="truncate text-xl font-semibold tracking-tight">{nombre || t("patient")}</h1>
          {paciente?.docId && <p className="text-xs text-muted-foreground">ID {paciente.docId}</p>}
        </div>
        <div className="flex items-center gap-2">
          {record && (
            <span className="rounded-lg bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ring-1 ring-border">#{record}</span>
          )}
          {factura.numero != null && (
            <span className="rounded-md bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ring-1 ring-border">
              {factura.serie ? `${factura.serie}-` : "F"}{String(factura.numero)}
            </span>
          )}
          <EstadoBadge estado={estado} />
          <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
            {tRoot("receipt.print")}
          </Button>
        </div>
      </div>

      {/* Editor keyeado por updatedAt → tras guardar, remonta con los valores del servidor. */}
      <Editor
        key={String(factura.updatedAt ?? factura.id)}
        factura={factura}
        id={id}
        centro={centro}
        catalogo={catalogo}
        formas={formas}
        busy={busy}
        run={run}
      />

      {/* Vista previa del recibo térmico 80mm (el print CSS lo aísla al imprimir). */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between no-print">
          <h2 className="text-sm font-semibold text-muted-foreground">{tRoot("receipt.previewTitle")}</h2>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
            {tRoot("receipt.print")}
          </Button>
        </div>
        <div className="flex justify-center rounded-xl border bg-muted/30 p-6">
          <div className="shadow-lg ring-1 ring-border">
            <ReciboTermico recibo={recibo} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Editor({
  factura,
  id,
  centro,
  catalogo,
  formas,
  busy,
  run,
}: {
  factura: FacturaConItems;
  id: string;
  centro?: string;
  catalogo: Producto[];
  formas: FormaPago[];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useTranslations("facturacion");
  const serverItems = React.useMemo(() => factura.items ?? [], [factura.items]);
  const estado = String(factura.estado ?? "");
  const esBorrador = estado === "borrador";

  // Ediciones locales (cantidad/precio) por item → cálculo INSTANTÁNEO al teclear;
  // se persiste al salir del campo. Sembrado del servidor (el padre remonta al guardar).
  type Edit = { cantidad: number; precioUnitario: number };
  const [edits, setEdits] = React.useState<Record<string, Edit>>(() =>
    Object.fromEntries(serverItems.map((it) => [it.id, { cantidad: n(it.cantidad) || 1, precioUnitario: n(it.precioUnitario) }])),
  );

  const lineTotal = (it: FacturaItem) => {
    const e = edits[it.id] ?? { cantidad: n(it.cantidad), precioUnitario: n(it.precioUnitario) };
    return e.cantidad * e.precioUnitario;
  };
  // Totales EN VIVO (cliente): subtotal = Σ líneas; descuento global desde tipo/valor;
  // impuesto del servidor (0 en consulta). total = subtotal − descuento + impuesto.
  const subtotal = serverItems.reduce((s, it) => s + lineTotal(it), 0);
  const dtipo = String(factura.descuentoGlobalTipo ?? "");
  const dval = n(factura.descuentoGlobalValor);
  const descuento = dtipo === "porcentaje" ? (subtotal * dval) / 100 : dtipo === "monto" ? dval : n(factura.descuento);
  const impuesto = n(factura.impuesto);
  const total = Math.max(0, subtotal - descuento + impuesto);
  const saldo = total - n(factura.montoAbonado);

  function setEdit(itemId: string, p: Partial<Edit>) {
    setEdits((m) => ({ ...m, [itemId]: { ...(m[itemId] ?? { cantidad: 1, precioUnitario: 0 }), ...p } }));
  }
  function persist(it: FacturaItem) {
    const e = edits[it.id];
    if (!e) return;
    if (e.cantidad !== n(it.cantidad) || e.precioUnitario !== n(it.precioUnitario)) {
      run(() => actualizarItem(id, it.id, { cantidad: e.cantidad, precioUnitario: e.precioUnitario }, centro));
    }
  }

  return (
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
              {serverItems.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t("noItems")}</td></tr>
              )}
              {serverItems.map((it) => {
                const e = edits[it.id] ?? { cantidad: n(it.cantidad), precioUnitario: n(it.precioUnitario) };
                return (
                  <tr key={it.id}>
                    <td className="px-3 py-2">{it.descripcion ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {esBorrador ? (
                        <Input
                          value={String(e.cantidad)}
                          onChange={(ev) => setEdit(it.id, { cantidad: Math.max(1, Math.floor(Number(ev.target.value) || 0)) })}
                          onBlur={() => persist(it)}
                          className="h-7 w-16 text-right tabular-nums" inputMode="numeric" disabled={busy}
                        />
                      ) : <span className="tabular-nums">{n(it.cantidad)}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {esBorrador ? (
                        <Input
                          value={String(e.precioUnitario)}
                          onChange={(ev) => setEdit(it.id, { precioUnitario: Math.max(0, Number(ev.target.value) || 0) })}
                          onBlur={() => persist(it)}
                          className="h-7 w-24 text-right tabular-nums" inputMode="decimal" disabled={busy}
                        />
                      ) : <span className="tabular-nums">{money(it.precioUnitario)}</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{money(lineTotal(it))}</td>
                    {esBorrador && (
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => run(() => eliminarItem(id, it.id, centro))} disabled={busy} aria-label={t("remove")} className="text-destructive hover:opacity-70 disabled:opacity-40">×</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {esBorrador && <AddItem catalogo={catalogo} disabled={busy} onAdd={(p) => run(() => agregarItem(id, p, centro))} />}
      </section>

      {/* Resumen + acciones */}
      <aside className="space-y-4">
        <div className="space-y-2 rounded-xl border p-4">
          <Row label={t("subtotal")} value={money(subtotal)} />
          <Row label={t("discount")} value={`- ${money(descuento)}`} />
          <Row label={t("tax")} value={money(impuesto)} />
          <div className="border-t pt-2"><Row label={t("total")} value={money(total)} strong /></div>
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
          <Button className="w-full" disabled={busy || serverItems.length === 0} onClick={() => run(() => emitirFactura(id, centro))}>
            {t("emit")}
          </Button>
        ) : (
          <Pago formas={formas} disabled={busy} saldo={saldo} onPay={(formaPagoId, monto, notas) => run(() => registrarPago(id, { formaPagoId, monto, ...(notas ? { notas } : {}) } as never, centro))} />
        )}
      </aside>
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

function AddItem({ catalogo, disabled, onAdd }: { catalogo: Producto[]; disabled?: boolean; onAdd: (p: { productoId: string; descripcion: string; cantidad: number; precioUnitario: number; gravado?: boolean }) => void }) {
  const t = useTranslations("facturacion");
  const [prodId, setProdId] = React.useState("");
  const [cant, setCant] = React.useState("1");
  const [precio, setPrecio] = React.useState("");
  const prod = catalogo.find((p) => p.id === prodId);
  const previewTotal = (Math.max(1, Math.floor(Number(cant) || 0)) * Math.max(0, Number(precio) || 0));
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
          <SelectContent>{catalogo.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
        </Select>
      </label>
      <Input value={cant} onChange={(e) => setCant(e.target.value)} className="h-9 w-16 text-right tabular-nums" inputMode="numeric" aria-label={t("qty")} />
      <Input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0.00" className="h-9 w-24 text-right tabular-nums" inputMode="decimal" aria-label={t("price")} />
      <span className="min-w-16 pb-2 text-right text-sm font-medium tabular-nums text-muted-foreground">{money(previewTotal)}</span>
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

function Pago({ formas, disabled, saldo, onPay }: { formas: FormaPago[]; disabled?: boolean; saldo: number; onPay: (formaPagoId: string, monto: number, notas?: string) => void }) {
  const t = useTranslations("facturacion");
  const [formaId, setFormaId] = React.useState("");
  const [monto, setMonto] = React.useState(saldo > 0 ? String(saldo.toFixed(2)) : "");
  const [last4, setLast4] = React.useState("");
  const canPay = !!formaId && Number(monto) > 0 && !disabled;
  // La tarjeta (forma NO efectivo) permite anotar los últimos 4 (opcional).
  const forma = formas.find((f) => f.id === formaId);
  const esTarjeta = !!forma && forma.esEfectivo === false;
  if (saldo <= 0) return <p className="rounded-xl border bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">{t("fullyPaid")}</p>;
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("payment")}</span>
      <Select value={formaId} onValueChange={setFormaId}>
        <SelectTrigger className="w-full"><SelectValue placeholder={t("payMethod")} /></SelectTrigger>
        <SelectContent>{formas.filter((f) => f.activo !== false).map((f) => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}</SelectContent>
      </Select>
      {esTarjeta && (
        <Input
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder={t("cardLast4")}
          className="h-9 w-full tabular-nums"
          inputMode="numeric"
          aria-label={t("cardLast4")}
        />
      )}
      <div className="flex items-center gap-2">
        <Input value={monto} onChange={(e) => setMonto(e.target.value)} className="h-9 flex-1 text-right tabular-nums" inputMode="decimal" />
        <Button type="button" disabled={!canPay} onClick={() => onPay(formaId, Math.max(0, Number(monto) || 0), last4.length === 4 ? `•••• ${last4}` : undefined)}>{t("registerPayment")}</Button>
      </div>
    </div>
  );
}
