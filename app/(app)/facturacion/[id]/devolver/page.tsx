"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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

// Devolución a PANTALLA COMPLETA (tipo factura): tabla ancha de líneas con cantidad/sesiones a
// devolver + reembolso editable + componentes de kit expandibles; panel lateral con política, motivo,
// forma de reembolso y NETO en vivo. Reemplaza el modal (no práctico para facturas con muchos ítems).
export default function DevolverFacturaPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const centro = useSearchParams().get("centro") ?? undefined;
  const router = useRouter();
  const t = useTranslations("facturacionList.actions");
  const tf = useTranslations("facturacion");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const { state: facturaState, reload: recargarFactura } = useResource<FacturaConItems>(() => getFactura(id, centro), [id, centro]);
  const formasRes = useResource<FormaPago[]>(() => getFormasPago(centro), [centro]);
  const factura = facturaState.kind === "ok" ? facturaState.data : null;
  const items = React.useMemo<FacturaItem[]>(() => factura?.items ?? [], [factura]);
  const formas = (formasRes.state.kind === "ok" ? formasRes.state.data : []).filter((f) => f.activo !== false);

  const [politica, setPolitica] = React.useState<"como_facturada" | "precio_base">("como_facturada");
  const [cant, setCant] = React.useState<Record<string, string>>({});
  const [ses, setSes] = React.useState<Record<string, string>>({});
  const [precio, setPrecio] = React.useState<Record<string, string>>({});
  const [bases, setBases] = React.useState<Record<string, number>>({});
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [compCant, setCompCant] = React.useState<Record<string, string>>({});
  const [compPrecio, setCompPrecio] = React.useState<Record<string, string>>({});
  const [motivo, setMotivo] = React.useState("");
  const [formaId, setFormaId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // a_la_entrega se devuelve por SESIONES no entregadas; el resto por cantidad. Si el ítem a_la_entrega
  // no trae sesiones (>0), caemos a cantidad para no mostrar la línea "en cero".
  const esEntrega = (it: FacturaItem) => String(it.modoDescarga) === "a_la_entrega" && n(it.sesiones) > 0;
  const dispCant = (it: FacturaItem) => n(it.cantidad) - n((it as { cantidadDevuelta?: number }).cantidadDevuelta);
  const dispSes = (it: FacturaItem) => n(it.sesiones) - n((it as { sesionesDevueltas?: number }).sesionesDevueltas);
  const compsDe = (it: FacturaItem): CompRow[] =>
    ((it as { contenido?: CompRow[] }).contenido ?? []).filter((c) => c.facturaItemComponenteId);
  const ck = (itemId: string, ficId: string) => `${itemId}::${ficId}`;

  const defaultRefund = (it: FacturaItem) => {
    const base = esEntrega(it) ? dispSes(it) : dispCant(it);
    const q = esEntrega(it) ? Number(ses[it.id] || 0) : Number(cant[it.id] || 0);
    if (base <= 0 || q <= 0) return 0;
    return (q / base) * (n(it.total) || n(it.cantidad) * n(it.precioUnitario));
  };
  const refundDe = (it: FacturaItem) => (precio[it.id]?.trim() ? Number(precio[it.id]) : defaultRefund(it));
  const compSelDe = (it: FacturaItem) => compsDe(it).filter((c) => Number(compCant[ck(it.id, String(c.facturaItemComponenteId))] || 0) > 0);
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

  React.useEffect(() => {
    if (politica !== "precio_base") return;
    const faltan = Array.from(new Set(items.map((it) => String(it.productoId)))).filter((p) => p && bases[p] == null);
    if (!faltan.length) return;
    Promise.all(faltan.map((p) => getPrecioBase(p, centro).then((r) => [p, r.precioBase] as const).catch(() => null)))
      .then((rs) => setBases((m) => ({ ...m, ...Object.fromEntries(rs.filter(Boolean) as [string, number][]) })));
  }, [politica, items, centro, bases]);

  const backHref = `/facturacion/${id}${centro ? `?centro=${centro}` : ""}`;

  async function confirmar() {
    if (!motivo.trim() || seleccion.length === 0 || busy) return;
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

  const pac = factura?.paciente;
  const pacNombre = pac ? [pac.nombres, pac.apellidos].filter(Boolean).join(" ") : "";

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">← {tf("back")}</Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent px-5 py-4">
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
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
          {/* Tabla de líneas (a pantalla ancha, como la factura) */}
          <section className="overflow-x-auto rounded-xl border">
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
                  const disp = entrega ? dispSes(it) : dispCant(it);
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
                            onChange={(e) => (entrega ? setSes : setCant)((m) => ({ ...m, [it.id]: e.target.value }))}
                            className="h-8 w-20 text-right tabular-nums" placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number" placeholder={defaultRefund(it) ? defaultRefund(it).toFixed(2) : "0.00"}
                            value={precio[it.id] ?? ""}
                            onChange={(e) => setPrecio((m) => ({ ...m, [it.id]: e.target.value }))}
                            className="h-8 w-24 text-right tabular-nums"
                          />
                        </td>
                      </tr>
                      {expanded[it.id] && comps.map((c) => {
                        const key = ck(it.id, String(c.facturaItemComponenteId));
                        return (
                          <tr key={key} className="bg-muted/20 text-xs">
                            <td className="px-3 py-1.5 pl-8">{n(c.cantidad)} · {c.nombre}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{money(c.precio)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{n(c.cantidad)}</td>
                            <td className="px-3 py-1.5 text-right">
                              <Input type="number" min={0} max={n(c.cantidad)} value={compCant[key] ?? ""} onChange={(e) => setCompCant((m) => ({ ...m, [key]: e.target.value }))} className="h-7 w-16 text-right tabular-nums" placeholder="0" />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <Input type="number" value={compPrecio[key] ?? ""} onChange={(e) => setCompPrecio((m) => ({ ...m, [key]: e.target.value }))} className="h-7 w-20 text-right tabular-nums" placeholder={money(c.precio)} />
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

          {/* Panel lateral: política + motivo + reembolso + neto + confirmar */}
          <aside className="space-y-4 lg:sticky lg:top-6 h-fit">
            <div className="space-y-3 rounded-xl border p-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{t("policy")}</span>
                <Select value={politica} onValueChange={(v) => setPolitica(v as "como_facturada" | "precio_base")}>
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
                  <SelectContent>{formas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{neto >= 0 ? t("netRefund") : t("netOwed")}</span>
                <span className={"text-xl font-bold tabular-nums " + (neto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{money(Math.abs(neto))}</span>
              </div>
              <Button className="mt-3 w-full" disabled={busy || !motivo.trim() || seleccion.length === 0} onClick={confirmar}>
                {t("return")} ({seleccion.length})
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
