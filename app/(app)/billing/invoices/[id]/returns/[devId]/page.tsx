"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, ArrowLeft01Icon, Cancel01Icon, InvoiceIcon } from "@hugeicons/core-free-icons";

import { loadRefundRecibo } from "@/lib/api/refund-receipt";
import type { Recibo } from "@/lib/factura/build-recibo";
import { listDevolucionesDeFactura, anularDevolucion, type Devolucion } from "@/lib/api/facturas";
import { invoiceDetailHref } from "@/lib/facturacion/invoice-clinics";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { ReturnSummarySkeleton } from "@/components/facturacion/invoice-return-skeleton";
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
// secundaria), que muestra lo VENDIDO (3 y 3), nunca lo DEVUELTO (2 HILT y 2 MLS) — para el dueño eso
// era «la devolución tiene 3». Mismo loader que el recibo impreso (loadRefundRecibo), misma cantidad
// devuelta (quantity, o sessions si aquella es 0, desde 3ca63bb). Handoff .personal/handoff-ver-devolucion.md.
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

  const { state, refresh } = useResource<Recibo>(() => loadRefundRecibo(id, devId, centro), [id, devId, centro]);
  // Solo para el «tipo» (total/parcial): el recibo no lo trae, la lista de la factura sí. Nunca
  // bloquea la pantalla si falla — es un dato secundario de la cabecera.
  const tipoRes = useResource<Devolucion | undefined>(
    () => listDevolucionesDeFactura(id, centro).then((rows) => rows.find((r) => r.id === devId)),
    [id, devId, centro],
  );
  const tipo = tipoRes.state.kind === "ok" ? tipoRes.state.data?.type : undefined;

  const [anular, setAnular] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
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

  const recibo = state.kind === "ok" ? state.data : null;
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
      ) : state.kind === "fail" || !recibo ? (
        <p className="text-sm text-destructive">{state.kind === "fail" ? state.message : tRoot("facturacion.notFound")}</p>
      ) : (
        <>
          <PageHeader
            title={
              <>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-primary/80">{t("verDevolucion")}</span>
                {recibo.numeroDisplay}
              </>
            }
            count={<Badge variant={recibo.estado === "anulada" ? "destructive" : "success"}>{tEstado.has(recibo.estado) ? tEstado(recibo.estado) : recibo.estado || "—"}</Badge>}
            actions={
              <div className="flex gap-2">
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
                {recibo.estado === "activa" && can("factura.devolver") && (
                  <Button variant="outline" size="sm" onClick={() => setAnular(true)}>
                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                    {t("anular")}
                  </Button>
                )}
              </div>
            }
          />

          <div className="mt-2 grid gap-5 lg:grid-cols-[1fr_20rem]">
            <section className="space-y-4">
              <Card>
                <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 pt-6 sm:grid-cols-3">
                  <Field label={t("col.fecha")} value={recibo.fecha ? format.dateTime(new Date(recibo.fecha), "dayShort") : "—"} />
                  {tipo && <Field label={t("col.tipo")} value={t(`tipo.${tipo}`)} />}
                  <Field
                    label={t("fromInvoiceLabel")}
                    value={recibo.facturaOrigen ?? "—"}
                    href={recibo.facturaOrigen ? invoiceDetailHref(id, centro) : undefined}
                  />
                  <Field label={tRoot("facturacion.patient")} value={recibo.paciente.nombre || "—"} />
                  <Field label={t("col.motivo")} value={recibo.motivo || "—"} />
                  <Field label={t("atendidoPor")} value={recibo.atendidoPor || "—"} />
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
                      {recibo.items.map((it, i) => (
                        <tr key={i}>
                          <td className="py-2">{it.descripcion}</td>
                          <td className="py-2 text-right tabular-nums">{it.cantidad}</td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">{money(it.precioUnitario)}</td>
                          <td className="py-2 text-right font-medium tabular-nums">{money(it.total)}</td>
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
                  <Row label={tRoot("facturacion.subtotal")} value={money(recibo.subtotal)} />
                  <Row label={tRoot("facturacion.tax")} value={money(recibo.impuesto)} />
                  <Row label={tRoot("facturacion.total")} value={money(recibo.total)} strong />
                  <div className="mt-2 border-t pt-2">
                    <span className="text-xs font-medium text-muted-foreground">{t("formaReembolso")}</span>
                    <p className="text-sm">
                      {recibo.pagos.length > 0
                        ? formaPagoLabel(tRoot, recibo.pagos[0].clave, recibo.pagos[0].formaPagoNombre)
                        : t("sinReembolso")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
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
