"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { pickableMethods } from "@/lib/factura/payment-methods";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
import { updateRefund, replaceRefundReimbursements, type RefundDetail } from "@/lib/api/refund-detail";
import type { FormaPago } from "@/lib/api/facturas";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

// «Editar» la devolución (motivo y notas) — BE PR #577, PATCH, permiso `factura.refund.repair`.
export function EditRefundDialog({
  open,
  onOpenChange,
  refund,
  invoiceId,
  centro,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  refund: RefundDetail;
  invoiceId: string;
  centro?: string;
  onSaved: (r: RefundDetail) => void;
}) {
  const t = useTranslations("devoluciones");
  const tRoot = useTranslations();
  const [reason, setReason] = React.useState(refund.reason ?? "");
  const [notes, setNotes] = React.useState(refund.notes ?? "");
  const [busy, setBusy] = React.useState(false);

  // Precarga al ABRIR (no en un effect): se ajusta en el render mismo, comparando con el `open`
  // anterior — evita el doble render de un setState síncrono dentro de un effect.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason(refund.reason ?? "");
      setNotes(refund.notes ?? "");
    }
  }

  async function guardar() {
    setBusy(true);
    try {
      const r = await updateRefund(invoiceId, refund.id, { reason: reason.trim(), notes: notes.trim() }, centro);
      toast.success(t("editadaOk"));
      onSaved(r);
      onOpenChange(false);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editarTitle")}</DialogTitle>
          <DialogDescription>{refund.displayNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">{t("col.motivo")}</Label>
            <Input id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-notes">{t("notas")}</Label>
            <Textarea id="refund-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{tRoot("common.cancel")}</Button>
          <Button onClick={guardar} disabled={busy || !reason.trim()}>{busy ? tRoot("common.loading") : tRoot("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Linea = { paymentMethodId: string; amount: string };

// «Reparar reembolso»: reemplaza POR COMPLETO los reembolsos (una o varias formas — Visa + cheque a la
// vez), deben sumar exacto a `refundedAmount`. Precargada con los reembolsos ACTIVOS de hoy (si falta
// registrar una parte, se agrega una línea; si está mal repartido, se corrige). El PUT pide confirmación
// (428/X-Confirm-Action) — la maneja apiFetch solo, no hay nada que hacer aquí.
export function RepairReimbursementsDialog({
  open,
  onOpenChange,
  refund,
  formas,
  invoiceId,
  centro,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  refund: RefundDetail;
  formas: FormaPago[];
  invoiceId: string;
  centro?: string;
  onSaved: (r: RefundDetail) => void;
}) {
  const t = useTranslations("devoluciones");
  const tRoot = useTranslations();
  const [lineas, setLineas] = React.useState<Linea[]>([]);
  const [motivo, setMotivo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const opciones = pickableMethods(formas);

  // Precarga al ABRIR, ajustada en el render (mismo patrón que EditRefundDialog arriba).
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const activos = refund.reimbursements.filter((r) => r.status === "activo");
      setLineas(
        activos.length
          ? activos.map((r) => ({ paymentMethodId: r.paymentMethodId, amount: String(n(r.amount).toFixed(2)) }))
          : [{ paymentMethodId: "", amount: String(n(refund.refundedAmount).toFixed(2)) }],
      );
      setMotivo("");
    }
  }

  const total = lineas.reduce((s, l) => s + n(l.amount), 0);
  const target = n(refund.refundedAmount);
  const cuadra = Math.abs(total - target) < 0.01;
  const valido = cuadra && motivo.trim() && lineas.every((l) => l.paymentMethodId && n(l.amount) > 0);

  function setLinea(i: number, patch: Partial<Linea>) {
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function guardar() {
    if (!valido || busy) return;
    setBusy(true);
    try {
      const r = await replaceRefundReimbursements(
        invoiceId,
        refund.id,
        { reimbursements: lineas.map((l) => ({ paymentMethodId: l.paymentMethodId, amount: n(l.amount) })), reason: motivo.trim() },
        centro,
      );
      toast.success(t("reparadaOk"));
      onSaved(r);
      onOpenChange(false);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("repararTitle")}</DialogTitle>
          <DialogDescription>{t("repararBody", { total: money(target) })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {lineas.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Select value={l.paymentMethodId} onValueChange={(v) => setLinea(i, { paymentMethodId: v })}>
                <SelectTrigger size="sm" className="h-8 flex-1"><SelectValue placeholder={t("colMetodo")} /></SelectTrigger>
                <SelectContent>
                  {opciones.map((f) => <SelectItem key={f.id} value={f.id}>{formaPagoLabel(tRoot, f.slug, f.name)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                value={l.amount}
                onChange={(e) => setLinea(i, { amount: e.target.value })}
                inputMode="decimal"
                onFocus={(e) => e.currentTarget.select()}
                className="h-8 w-24 text-right tabular-nums"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                disabled={lineas.length <= 1}
                onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setLineas((ls) => [...ls, { paymentMethodId: "", amount: "" }])}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("agregarLinea")}
          </Button>
        </div>

        <div className={"flex justify-between text-sm font-medium " + (cuadra ? "text-success-foreground" : "text-destructive")}>
          <span>{t("colMonto")}</span>
          <span className="tabular-nums">{money(total)} / {money(target)}</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="repair-reason">{t("col.motivo")}</Label>
          <Input id="repair-reason" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("repararMotivoPlaceholder")} autoFocus />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{tRoot("common.cancel")}</Button>
          <Button onClick={guardar} disabled={!valido || busy}>{busy ? tRoot("common.loading") : t("reparar")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
