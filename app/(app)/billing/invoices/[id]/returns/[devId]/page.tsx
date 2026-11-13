"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, ArrowLeft01Icon, Cancel01Icon, InvoiceIcon, Edit02Icon, Alert02Icon } from "@hugeicons/core-free-icons";

import { anularDevolucion, getFormasPago, type FormaPago } from "@/lib/api/facturas";
import { getRefundDetail, type RefundDetail } from "@/lib/api/refund-detail";
import { cantidadDevuelta } from "@/lib/factura/build-recibo";
import { invoiceDetailHref } from "@/lib/facturacion/invoice-clinics";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
import { formatFechaSolo } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReturnSummarySkeleton } from "@/components/facturacion/invoice-return-skeleton";
import { EditRefundDialog, RepairReimbursementsDialog } from "@/components/facturacion/refund-repair";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

// «Ver devolución» — el detalle PROPIO de una devolución (D-000028), acción principal de su fila en
// la lista. Antes lo único que se podía VER era la factura de origen («Ver factura», ahora acción
// secundaria), que muestra lo VENDIDO (3 y 3), nunca lo DEVUELTO (2 HILT y 2 MLS).
// Desde BE PR #577 (handoff .personal/handoff-reparar-devolucion.md) usa el detalle propio
// (GET /invoices/:id/refunds/:refundId), no el recibo: trae notas, TODOS los reembolsos (anulados
// incluidos) y `reimbursementGap`, y permite editar motivo/notas y reparar por dónde salió el dinero.
// El recibo IMPRESO (botón «Imprimir») sigue en su propia ruta, sin tocar.
export default function DevolucionDetallePage() {
  const params = useParams<{ id: string; devId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const id = String(params.id);
  const devId = String(params.devId);
  const centro = search.get("centro") ?? undefined;
  const t = useTranslations("devoluciones");
  const tEstado = useTranslations("devoluciones.estado");
  const tRoot = useTranslations();
  const format = useFormatter();
  const { can } = useCan();
  const puedeReparar = can("factura.refund.repair");

  const { state, refresh } = useResource<RefundDetail>(() => getRefundDetail(id, devId, centro), [id, devId, centro]);
  const formasRes = useResource<FormaPago[]>(() => getFormasPago(centro), [centro]);
  const formas = formasRes.state.kind === "ok" ? formasRes.state.data : [];

  const [anular, setAnular] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [editar, setEditar] = React.useState(false);
  const [reparar, setReparar] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function confirmarAnular() {
    if (!motivo.trim() || busy) return;
    setBusy(true);
    try {
      await anularDevolucion(id, devId, motivo.trim(), centro);
      toast.success(t("anuladaOk"));
      setAnular(false);
      setMotivo("");
      refresh();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  const refund = state.kind === "ok" ? state.data : null;
  const backHref = `/billing/invoices/${id}${centro ? `?centro=${centro}` : ""}`;
  const printHref = `/billing/invoices/${id}/returns/${devId}/receipt${centro ? `?centro=${centro}` : ""}`;

  return (
    <PageContainer>
      <Link href={backHref} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        {tRoot("facturacion.back")}
      </Link>

      {state.kind === "loading" ? (
        <ReturnSummarySkeleton />
      ) : state.kind === "fail" || !refund ? (
        <p className="text-sm text-destructive">{state.kind === "fail" ? state.message : tRoot("facturacion.notFound")}</p>
      ) : (
        <>
          <PageHeader
            title={
              <>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-primary/80">{t("verDevolucion")}</span>
                {refund.displayNumber}
              </>
            }
            count={<Badge variant={refund.status === "anulada" ? "destructive" : "success"}>{tEstado.has(refund.status) ? tEstado(refund.status) : refund.status || "—"}</Badge>}
            actions={
              <div className="flex flex-wrap gap-2">
                {puedeReparar && refund.status === "activa" && (
                  <Button variant="outline" size="sm" onClick={() => setEditar(true)}>
                    <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                    {tRoot("common.edit")}
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={printHref}>
                    <HugeiconsIcon icon={PrinterIcon} className="size-4" />
                    {t("imprimir")}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push(invoiceDetailHref(id, centro))}>
                  <HugeiconsIcon icon={InvoiceIcon} className="size-4" />
                  {t("verFactura")}
                </Button>
                {refund.status === "activa" && can("factura.devolver") && (
                  <Button variant="outline" size="sm" onClick={() => setAnular(true)}>
                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                    {t("anular")}
                  </Button>
                )}
              </div>
            }
          />

          {refund.status === "anulada" && (
            <Alert variant="destructive">
              <AlertDescription>
                {t("anuladaInfo", { fecha: formatFechaSolo(refund.cancelledAt) || "—", quien: refund.cancelledByName || "—" })}
                {refund.cancellationReason && <span className="block">{refund.cancellationReason}</span>}
              </AlertDescription>
            </Alert>
          )}

          {refund.status === "activa" && Math.abs(refund.reimbursementGap) > 0.005 && (
            <Alert variant="warning">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Alert02Icon} className="size-4" />
                  {t("gapAviso", { monto: money(Math.abs(refund.reimbursementGap)) })}
                </span>
                {puedeReparar && (
                  <Button size="sm" onClick={() => setReparar(true)}>{t("reparar")}</Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-2 grid gap-5 lg:grid-cols-[1fr_20rem]">
            <section className="space-y-4">
              <Card>
                <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 pt-6 sm:grid-cols-3">
                  <Field label={t("col.fecha")} value={refund.date ? format.dateTime(new Date(refund.date), "dayShort") : "—"} />
                  <Field label={t("col.tipo")} value={tRoot.has(`devoluciones.tipo.${refund.type}`) ? t(`tipo.${refund.type}`) : refund.type} />
                  <Field
                    label={t("fromInvoiceLabel")}
                    value={refund.invoiceNumber ?? "—"}
                    href={refund.invoiceNumber ? invoiceDetailHref(id, centro) : undefined}
                  />
                  <Field label={tRoot("facturacion.patient")} value={refund.patient?.displayName || "—"} />
                  <Field label={t("col.motivo")} value={refund.reason || "—"} />
                  <Field label={t("atendidoPor")} value={refund.userName || "—"} />
                  {refund.notes && <Field label={t("notas")} value={refund.notes} />}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="overflow-x-auto pt-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 font-semibold">{tRoot("facturacion.concept")}</th>
                        <th className="pb-2 text-right font-semibold">{t("colCantidad")}</th>
                        <th className="pb-2 text-right font-semibold">{t("colPrecio")}</th>
                        <th className="pb-2 text-right font-semibold">{t("colMonto")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {refund.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2">{it.description}</td>
                          <td className="py-2 text-right tabular-nums">{cantidadDevuelta(it)}</td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">{money(it.unitPrice)}</td>
                          <td className="py-2 text-right font-medium tabular-nums">{money(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </section>

            <aside className="space-y-3 lg:sticky lg:top-6 h-fit">
              <Card>
                <CardContent className="space-y-2 pt-6">
                  <Row label={tRoot("facturacion.subtotal")} value={money(refund.refundedAmount - refund.refundedTax)} />
                  <Row label={tRoot("facturacion.tax")} value={money(refund.refundedTax)} />
                  <Row label={tRoot("facturacion.total")} value={money(refund.refundedAmount)} strong />
                  <div className="mt-2 border-t pt-2">
                    <span className="text-xs font-medium text-muted-foreground">{t("formaReembolso")}</span>
                    {refund.reimbursements.length === 0 ? (
                      <p className="text-sm">{t("sinReembolso")}</p>
                    ) : (
                      <ul className="mt-1 space-y-1.5">
                        {refund.reimbursements.map((r) => (
                          <li key={r.id} className={"text-sm " + (r.status === "anulado" ? "text-muted-foreground line-through decoration-destructive/60" : "")}>
                            <span className="flex justify-between gap-2">
                              <span>{formaPagoLabel(tRoot, formas.find((f) => f.id === r.paymentMethodId)?.slug, r.paymentMethodName)}</span>
                              <span className="tabular-nums">{money(r.amount)}</span>
                            </span>
                            {r.status === "anulado" && (
                              <span className="block text-xs no-underline">
                                {t("anuladaPor", { quien: r.cancelledByName || "—", fecha: formatFechaSolo(r.cancelledAt) || "—" })}
                                {r.cancellationReason ? ` · ${r.cancellationReason}` : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      )}

      {refund && (
        <>
          <EditRefundDialog open={editar} onOpenChange={setEditar} refund={refund} invoiceId={id} centro={centro} onSaved={refresh} />
          <RepairReimbursementsDialog open={reparar} onOpenChange={setReparar} refund={refund} formas={formas} invoiceId={id} centro={centro} onSaved={refresh} />
        </>
      )}

      <AlertDialog open={anular} onOpenChange={(o) => !o && setAnular(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("anularTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("anularBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("anularReason")} autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={!motivo.trim() || busy} onClick={confirmarAnular}>{t("anular")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {href ? (
        <Link href={href} className="text-sm font-medium text-primary hover:underline">{value}</Link>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex justify-between gap-2 text-sm " + (strong ? "font-bold text-base" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
