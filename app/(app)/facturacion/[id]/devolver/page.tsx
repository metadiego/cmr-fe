"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";

import {
  getFactura,
  getFormasPago,
  getPrecioBase,
  devolverFactura,
  type FacturaConItems,
  type FacturaItem,
  type FormaPago,
  type DevolverPayload,
} from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { toastError, isRateLimited } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

type CompRow = { facturaItemComponenteId?: string | null; nombre?: string; cantidad?: number; precio?: number };

// Helpers PUROS (módulo) para poder pre-llenar en los initializers de useState.
// a_la_entrega se devuelve por SESIONES no entregadas; el resto por cantidad. Si a_la_entrega no trae
// sesiones (>0), cae a cantidad para no mostrar la línea "en cero".
const esEntrega = (it: FacturaItem) => String(it.modoDescarga) === "a_la_entrega" && n(it.sesiones) > 0;
const dispCant = (it: FacturaItem) => n(it.cantidad) - n((it as { cantidadDevuelta?: number }).cantidadDevuelta);
const dispSes = (it: FacturaItem) => n(it.sesiones) - n((it as { sesionesDevueltas?: number }).sesionesDevueltas);
const dispDe = (it: FacturaItem) => (esEntrega(it) ? dispSes(it) : dispCant(it));
const billedQty = (it: FacturaItem) => (esEntrega(it) ? n(it.sesiones) : n(it.cantidad)) || 0;
const lineBilledTotal = (it: FacturaItem) => n(it.total) || n(it.cantidad) * n(it.precioUnitario);
// Reembolso EXACTO facturado por unidad × devuelto (incluye descuento/impuesto tal como se facturó).
const exactRefund = (it: FacturaItem, q: number) => {
  const bq = billedQty(it);
  return bq > 0 ? (q / bq) * lineBilledTotal(it) : 0;
};
const compExactRefund = (c: CompRow, q: number) => {
  const bq = n(c.cantidad) || 0;
  return bq > 0 ? (q / bq) * n(c.precio) : 0;
};
const compsDe = (it: FacturaItem): CompRow[] => (it as { contenido?: CompRow[] }).contenido ?? [];
const ck = (itemId: string, ficId: string) => `${itemId}::${ficId}`;

// Devolución a PANTALLA COMPLETA (tipo factura). La lógica/estado vive en <DevolverForm>, remontado por
// key={factura.id} → sus initializers PRE-LLENAN "como facturada" con la factura exacta (cantidades
// completas + reembolso = total facturado). Editable hacia abajo para parciales.
export default function DevolverFacturaPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const centro = useSearchParams().get("centro") ?? undefined;
  const t = useTranslations("facturacionList.actions");
  const tf = useTranslations("facturacion");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const { state: facturaState, reload: recargarFactura } = useResource<FacturaConItems>(() => getFactura(id, centro), [id, centro]);
  const formasRes = useResource<FormaPago[]>(() => getFormasPago(centro), [centro]);
  const factura = facturaState.kind === "ok" ? facturaState.data : null;
  const items = factura?.items ?? [];
  const formas = (formasRes.state.kind === "ok" ? formasRes.state.data : []).filter((f) => f.activo !== false);

  const backHref = `/facturacion/${id}${centro ? `?centro=${centro}` : ""}`;
  const pac = factura?.paciente;
  const pacNombre = pac ? [pac.nombres, pac.apellidos].filter(Boolean).join(" ") : "";

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">← {tf("back")}</Link>

      <div className="mt-3 rounded-md ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] bg-gradient-to-br from-primary/10 to-transparent px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">{t("returnTitle")}</span>
            <h1 className="truncate text-xl font-semibold tracking-tight">{pacNombre || t("returnTitle")}</h1>
          </div>
          {factura?.numero != null && (
            <span className="rounded-md bg-background/70 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ring-1 ring-border">
              {factura.serie ? `${factura.serie}-` : "F"}{String(factura.numero)}
            </span>
          )}
        </div>
        {/* Resumen de la factura (referencia): subtotal, descuento (%/$), impuesto (detalle al click), total */}
        {factura && <ResumenFactura factura={factura} />}
      </div>

      {facturaState.kind === "loading" ? (
        <p className="mt-8 text-sm text-muted-foreground">{tc("loading")}</p>
      ) : facturaState.kind === "fail" ? (
        <div className="mt-8 flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            {isRateLimited(facturaState.message) ? tRoot("common.rateLimited") : facturaState.message}
          </p>
          <Button variant="outline" size="sm" onClick={recargarFactura}>{tRoot("common.retry")}</Button>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{tf("noItems")}</p>
      ) : !["emitida", "devuelta_parcial"].includes(String(factura?.estado)) ? (
        <div className="mt-8 flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{t("returnOnlyIssued")}</p>
          <Button variant="outline" size="sm" asChild><Link href={backHref}>{tf("back")}</Link></Button>
        </div>
      ) : (
        <DevolverForm key={factura!.id} factura={factura!} formas={formas} id={id} centro={centro} backHref={backHref} />
      )}
    </div>
  );
}

// Resumen de la factura en la cabecera (referencia clara de lo que se está devolviendo).
function ResumenFactura({ factura }: { factura: FacturaConItems }) {
  const tf = useTranslations("facturacion");
  const [verImp, setVerImp] = React.useState(false);
  const f = factura as unknown as {
    subtotal?: number; descuento?: number; descuentoGlobalTipo?: string; descuentoGlobalValor?: number;
    impuesto?: number; total?: number; impuestos?: { nombre?: string; tasa?: number; monto?: number }[];
  };
  const desc = n(f.descuento);
  const descTxt =
    f.descuentoGlobalTipo === "porcentaje" && n(f.descuentoGlobalValor) > 0
      ? `${n(f.descuentoGlobalValor)}% · ${money(desc)}`
      : money(desc);
  // Desglose del IVU (Estatal + Municipal) TAL CUAL del BE; sin filtrar por monto>0 (un 0,00 gravado va).
  const imps = f.impuestos ?? [];

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{tf("subtotal")}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{money(f.subtotal)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{tf("discount")}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{desc > 0 ? `- ${descTxt}` : money(0)}</span>
        </div>
        <div className="flex flex-col">
          <button type="button" onClick={() => setVerImp((v) => !v)} className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
            {tf("tax")} {imps.length > 0 ? (verImp ? "▾" : "▸") : ""}
          </button>
          <span className="text-sm font-medium tabular-nums">{money(f.impuesto)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">{tf("total")}</span>
          <span className="text-base font-bold tabular-nums">{money(f.total)}</span>
        </div>
      </div>
      {verImp && imps.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {imps.map((im, i) => (
            <div key={i} className="flex justify-between gap-4 text-xs text-muted-foreground">
              <span>{(im.nombre || tf("tax")) + (im.tasa != null ? ` (${im.tasa}%)` : "")}</span>
              <span className="tabular-nums">{money(im.monto)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DevolverForm({
  factura,
  formas,
  id,
  centro,
  backHref,
}: {
  factura: FacturaConItems;
  formas: FormaPago[];
  id: string;
  centro?: string;
  backHref: string;
}) {
  const t = useTranslations("facturacionList.actions");
  const tf = useTranslations("facturacion");
  const router = useRouter();
  const tRoot = useTranslations();
  const items = React.useMemo<FacturaItem[]>(() => factura.items ?? [], [factura]);

  // PRE-LLENADO "como facturada" (default): cantidades COMPLETAS + reembolso EXACTO = total facturado.
  // Se hace en los initializers (una vez al montar, keyed por factura.id) → sin effects.
  const [politica, setPolitica] = React.useState<"como_facturada" | "precio_base">("como_facturada");
  const [cant, setCant] = React.useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    items.forEach((it) => { if (!esEntrega(it)) { const d = dispCant(it); if (d > 0) m[it.id] = String(d); } });
    return m;
  });
  const [ses, setSes] = React.useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    items.forEach((it) => { if (esEntrega(it)) { const d = dispSes(it); if (d > 0) m[it.id] = String(d); } });
    return m;
  });
  const [precio, setPrecio] = React.useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    items.forEach((it) => { const d = dispDe(it); if (d > 0) m[it.id] = exactRefund(it, d).toFixed(2); });
    return m;
  });
  const [bases, setBases] = React.useState<Record<string, number>>({});
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [compCant, setCompCant] = React.useState<Record<string, string>>({});
  const [compPrecio, setCompPrecio] = React.useState<Record<string, string>>({});
  const [motivo, setMotivo] = React.useState("");
  const [formaId, setFormaId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const defaultRefund = (it: FacturaItem) => exactRefund(it, esEntrega(it) ? Number(ses[it.id] || 0) : Number(cant[it.id] || 0));
  const refundDe = (it: FacturaItem) => (precio[it.id]?.trim() ? Number(precio[it.id]) : defaultRefund(it));

  // Al cambiar cantidad en "como facturada", auto-rellena el reembolso EXACTO (editable). precio_base no toca.
  // Se topa al DISPONIBLE (no se puede devolver más de lo que queda): el atributo max no bloquea el tecleo.
  function onQtyChange(it: FacturaItem, val: string) {
    const disp = dispDe(it);
    const q0 = Number(val || 0);
    const val2 = val.trim() !== "" && q0 > disp ? String(disp) : val;
    (esEntrega(it) ? setSes : setCant)((m) => ({ ...m, [it.id]: val2 }));
    if (politica === "como_facturada") {
      const q = Number(val2 || 0);
      setPrecio((m) => ({ ...m, [it.id]: q > 0 ? exactRefund(it, q).toFixed(2) : "" }));
    }
  }
  function onCompQtyChange(it: FacturaItem, c: CompRow, val: string) {
    const key = ck(it.id, String(c.facturaItemComponenteId));
    setCompCant((m) => ({ ...m, [key]: val }));
    if (politica === "como_facturada") {
      const q = Number(val || 0);
      setCompPrecio((m) => ({ ...m, [key]: q > 0 ? compExactRefund(c, q).toFixed(2) : "" }));
    }
  }
  function cambiarPolitica(v: "como_facturada" | "precio_base") {
    setPolitica(v);
    if (v === "como_facturada") {
      setPrecio(() => {
        const next: Record<string, string> = {};
        items.forEach((it) => {
          const q = esEntrega(it) ? Number(ses[it.id] || 0) : Number(cant[it.id] || 0);
          if (q > 0) next[it.id] = exactRefund(it, q).toFixed(2);
        });
        return next;
      });
      setCompPrecio(() => {
        const next: Record<string, string> = {};
        items.forEach((it) => compsDe(it).forEach((c) => {
          const key = ck(it.id, String(c.facturaItemComponenteId));
          const q = Number(compCant[key] || 0);
          if (q > 0) next[key] = compExactRefund(c, q).toFixed(2);
        }));
        return next;
      });
    } else {
      setPrecio({});
      setCompPrecio({});
    }
  }

  const compSelDe = (it: FacturaItem) => compsDe(it).filter((c) => c.facturaItemComponenteId && Number(compCant[ck(it.id, String(c.facturaItemComponenteId))] || 0) > 0);
  const compRefund = (it: FacturaItem, c: CompRow) => {
    const key = ck(it.id, String(c.facturaItemComponenteId));
    if (compPrecio[key]?.trim()) return Number(compPrecio[key]);
    const total = n(c.cantidad) || 1;
    return total > 0 ? (Number(compCant[key] || 0) / total) * n(c.precio) : 0;
  };
  const lineSel = (it: FacturaItem) => (esEntrega(it) ? Number(ses[it.id] || 0) > 0 : Number(cant[it.id] || 0) > 0);
  const seleccion = items.filter((it) => lineSel(it) || compSelDe(it).length > 0);
  const neto = seleccion.reduce((s, it) => {
    let x = lineSel(it) ? refundDe(it) : 0;
    compSelDe(it).forEach((c) => (x += compRefund(it, c)));
    return s + x;
  }, 0);
  const excedeTotal = neto > n(factura.total) + 0.001;

  // precio_base: trae los precios base de referencia de los productos de la factura.
  React.useEffect(() => {
    if (politica !== "precio_base") return;
    const faltan = Array.from(new Set(items.map((it) => String(it.productoId)))).filter((p) => p && bases[p] == null);
    if (!faltan.length) return;
    Promise.all(faltan.map((p) => getPrecioBase(p, centro).then((r) => [p, r.precioBase] as const).catch(() => null)))
      .then((rs) => setBases((m) => ({ ...m, ...Object.fromEntries(rs.filter(Boolean) as [string, number][]) })));
  }, [politica, items, centro, bases]);

  async function confirmar() {
    if (!motivo.trim() || seleccion.length === 0 || busy || excedeTotal) return;
    setBusy(true);
    try {
      const payload: DevolverPayload = {
        motivo: motivo.trim(),
        politica,
        ...(formaId ? { formaReembolsoId: formaId } : {}),
        items: seleccion.map((it) => {
          const comps = compSelDe(it).map((c) => {
            const key = ck(it.id, String(c.facturaItemComponenteId));
            return {
              facturaItemComponenteId: String(c.facturaItemComponenteId),
              cantidad: Number(compCant[key]),
              ...(compPrecio[key]?.trim() ? { precioDevuelto: Number(compPrecio[key]) } : {}),
            };
          });
          return {
            facturaItemId: it.id,
            ...(lineSel(it) ? (esEntrega(it) ? { sesiones: Number(ses[it.id]) } : { cantidad: Number(cant[it.id]) }) : {}),
            ...(precio[it.id]?.trim() ? { precioDevuelto: Number(precio[it.id]) } : {}),
            ...(comps.length ? { componentes: comps } : {}),
          };
        }),
      };
      await devolverFactura(id, payload, centro);
      toast.success(t("returnDone"));
      router.push(backHref);
    } catch (err) {
      toastError(err, tRoot);
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
      <section className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{tf("concept")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colBilled")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colAvailable")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colReturn")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colRefund")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((it) => {
              const entrega = esEntrega(it);
              const disp = dispDe(it);
              const comps = compsDe(it);
              const base = bases[String(it.productoId)];
              return (
                <React.Fragment key={it.id}>
                  <tr className="align-top">
                    <td className="px-3 py-2">
                      <span className="font-medium">{it.descripcion ?? "—"}</span>
                      {entrega && <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-600 dark:text-sky-400">{t("byDelivery")}</span>}
                      {politica === "precio_base" && base != null && (
                        <span className="block text-[11px] text-muted-foreground">{t("basePriceRef", { v: money(base) })}</span>
                      )}
                      {comps.length > 0 && (
                        <button type="button" onClick={() => setExpanded((m) => ({ ...m, [it.id]: !m[it.id] }))} className="mt-1 block text-[11px] font-medium text-primary hover:underline">
                          {expanded[it.id] ? "▾ " : "▸ "}{t("returnComponents")} ({comps.length})
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {entrega ? n(it.sesiones) : n(it.cantidad)} × {money(it.precioUnitario)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{disp}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number" min={0} max={disp} disabled={disp <= 0}
                        value={(entrega ? ses[it.id] : cant[it.id]) ?? ""}
                        onChange={(e) => onQtyChange(it, e.target.value)}
                        className="h-8 w-20 text-right tabular-nums" placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number" min={0} placeholder={defaultRefund(it) ? defaultRefund(it).toFixed(2) : "0.00"}
                        value={precio[it.id] ?? ""}
                        onChange={(e) => { const v = e.target.value; setPrecio((m) => ({ ...m, [it.id]: v.trim() !== "" && Number(v) < 0 ? "0" : v })); }}
                        className="h-8 w-24 text-right tabular-nums"
                      />
                    </td>
                  </tr>
                  {expanded[it.id] && comps.map((c, ci) => {
                    const puede = !!c.facturaItemComponenteId;
                    const key = ck(it.id, String(c.facturaItemComponenteId));
                    return (
                      <tr key={puede ? key : `${it.id}::c${ci}`} className="bg-muted/20 text-xs">
                        <td className="px-3 py-1.5 pl-8">
                          {n(c.cantidad)} · {c.nombre}
                          {!puede && <span className="ml-2 text-[10px] text-muted-foreground/70">({t("compNoReturnable")})</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{money(c.precio)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{n(c.cantidad)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <Input type="number" min={0} max={n(c.cantidad)} disabled={!puede} value={puede ? (compCant[key] ?? "") : ""} onChange={(e) => onCompQtyChange(it, c, e.target.value)} className="h-7 w-16 text-right tabular-nums" placeholder="0" />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <Input type="number" min={0} disabled={!puede} value={puede ? (compPrecio[key] ?? "") : ""} onChange={(e) => { const v = e.target.value; setCompPrecio((m) => ({ ...m, [key]: v.trim() !== "" && Number(v) < 0 ? "0" : v })); }} className="h-7 w-20 text-right tabular-nums" placeholder={money(c.precio)} />
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-6 h-fit">
        <div className="space-y-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("policy")}</span>
            <Select value={politica} onValueChange={(v) => cambiarPolitica(v as "como_facturada" | "precio_base")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="como_facturada">{t("policyAsBilled")}</SelectItem>
                <SelectItem value="precio_base">{t("policyBasePrice")}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("returnReason")}</span>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("returnReason")} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("returnRefund")}</span>
            <Select value={formaId} onValueChange={setFormaId}>
              <SelectTrigger><SelectValue placeholder={t("returnRefundNone")} /></SelectTrigger>
              <SelectContent>{formas.map((f) => <SelectItem key={f.id} value={f.id}>{formaPagoLabel(tRoot, f.clave, f.nombre)}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>

        <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{neto >= 0 ? t("netRefund") : t("netOwed")}</span>
            <span className={"text-xl font-bold tabular-nums " + (neto >= 0 ? "text-success-foreground" : "text-destructive")}>{money(Math.abs(neto))}</span>
          </div>
          {excedeTotal && (
            <p className="mt-2 text-xs text-destructive">{t("netExceeds", { total: money(n(factura.total)) })}</p>
          )}
          <Button className="mt-3 w-full" disabled={busy || !motivo.trim() || seleccion.length === 0 || excedeTotal} onClick={confirmar}>
            {t("return")} ({seleccion.length})
          </Button>
        </div>
      </aside>
    </div>
  );
}
