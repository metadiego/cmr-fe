"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, ArrowLeft01Icon, Cancel01Icon, InvoiceIcon } from "@hugeicons/core-free-icons";

import { anularDevolucion, getFormasPago, type FormaPago } from "@/lib/api/facturas";
import { getRefundDetail, type RefundDetail } from "@/lib/api/refund-detail";
import { getProfiles, type Perfil } from "@/lib/api/profiles";
import { invoiceDetailHref } from "@/lib/facturacion/invoice-clinics";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReturnSummarySkeleton } from "@/components/facturacion/invoice-return-skeleton";
import { RefundEditorBody } from "@/components/facturacion/refund-editor-body";
import { RefundHistory } from "@/components/facturacion/refund-history";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// «Ver devolución» — un EDITOR EN SU SITIO (BE PR #580, handoff
// .personal/handoff-editar-devolucion-completa.md), no solo una pantalla de lectura: el dueño, sobre
// esta misma pantalla, «tiene que ser abierto» — toda línea editable, avisos en línea que nunca
// bloquean salvo regla del centro. D-000028 conserva su id y su número aunque se edite. El recibo
// IMPRESO (botón «Imprimir») sigue en su propia ruta, sin tocar.
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

  const { state, refresh } = useResource<RefundDetail>(() => getRefundDetail(id, devId, centro), [id, devId, centro]);
  const formasRes = useResource<FormaPago[]>(() => getFormasPago(centro), [centro]);
  const formas = formasRes.state.kind === "ok" ? formasRes.state.data : [];
  const perfilesRes = useResource<Perfil[]>(() => getProfiles(), []);
  const perfiles = perfilesRes.state.kind === "ok" ? perfilesRes.state.data : [];

  // Bumped on every save: part of the editor body's `key`, so it remounts and re-seeds every field
  // from the freshly refetched detail instead of keeping stale typed-over state.
  const [saveCount, setSaveCount] = React.useState(0);
  function onSaved() {
    setSaveCount((n) => n + 1);
    refresh();
  }

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

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{tRoot.has(`devoluciones.tipo.${refund.type}`) ? t(`tipo.${refund.type}`) : refund.type}</span>
            <span>·</span>
            {refund.invoiceNumber && (
              <Link href={invoiceDetailHref(id, centro)} className="text-primary hover:underline">{t("fromInvoiceLabel")} {refund.invoiceNumber}</Link>
            )}
            <span>·</span>
            <span>{refund.patient?.displayName || "—"}</span>
          </p>

          {refund.status === "anulada" && (
            <p className="text-sm text-destructive">
              {t("anuladaInfo", { fecha: refund.cancelledAt ? format.dateTime(new Date(refund.cancelledAt), "dayShort") : "—", quien: refund.cancelledByName || "—" })}
              {refund.cancellationReason && <span className="block">{refund.cancellationReason}</span>}
            </p>
          )}

          <Tabs defaultValue="editor" className="mt-2">
            <TabsList>
              <TabsTrigger value="editor">{t("editor.tabEditor")}</TabsTrigger>
              <TabsTrigger value="history">{t("editor.tabHistory")}</TabsTrigger>
            </TabsList>
            <TabsContent value="editor">
              {formasRes.state.kind !== "loading" && perfilesRes.state.kind !== "loading" && (
                <RefundEditorBody
                  key={`${refund.id}|${saveCount}`}
                  detail={refund}
                  formas={formas}
                  perfiles={perfiles}
                  invoiceId={id}
                  devId={devId}
                  centro={centro}
                  onSaved={onSaved}
                />
              )}
            </TabsContent>
            <TabsContent value="history">
              <RefundHistory invoiceId={id} devId={devId} centerId={centro} />
            </TabsContent>
          </Tabs>
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
