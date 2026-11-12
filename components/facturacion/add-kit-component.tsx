"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { addKitComponent, getItemOpcionales, type ItemOpcional } from "@/lib/api/facturas";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// «Agregar componente (sin cambiar el monto)» on a kit line of an ISSUED invoice (BE #574): an optional
// left out by mistake (the shoulder protocol's infiltration on 001229) is added without reopening the
// invoice, which would cancel the day's sessions. Shown only with factura.kit_agregar and only when the
// line has optionals not yet included. The 428 shield is answered by the shared confirm dialog.
export function AddKitComponent({
  invoiceId,
  itemId,
  centerId,
  disabled,
  onDone,
}: {
  invoiceId: string;
  itemId: string;
  centerId?: string;
  disabled?: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("facturacion.kit");
  const tRoot = useTranslations();
  const [options, setOptions] = React.useState<ItemOpcional[]>([]);
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getItemOpcionales(invoiceId, itemId, centerId)
      .then((list) => active && setOptions(list.filter((o) => !o.incluido)))
      .catch(() => active && setOptions([]));
    return () => {
      active = false;
    };
  }, [invoiceId, itemId, centerId]);

  if (options.length === 0) return null;

  const valid = !!picked && reason.trim().length >= 3;

  async function submit() {
    setBusy(true);
    try {
      await addKitComponent(invoiceId, itemId, { componenteId: picked, reason: reason.trim() }, centerId);
      toast.success(t("componentAdded"));
      setOptions((list) => list.filter((o) => o.componentId !== picked));
      setOpen(false);
      setPicked("");
      setReason("");
      onDone();
    } catch (err) {
      toastError(err, tRoot); // quiet when the person declined the confirmation
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="ml-2 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
      >
        {t("addComponentIssued")}
      </button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addComponentIssued")}</DialogTitle>
            <DialogDescription>{t("addComponentIssuedHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              {options.map((o) => (
                <label key={o.componentId} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="kit-component" value={o.componentId} checked={picked === o.componentId} onChange={() => setPicked(o.componentId)} />
                  <span className="flex-1">{o.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">×{o.quantity}</span>
                </label>
              ))}
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{t("reason")}</span>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder={t("reasonPlaceholder")} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {tRoot("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={!valid || busy}>
              {busy ? tRoot("common.loading") : t("addComponentConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
