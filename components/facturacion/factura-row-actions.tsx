"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import {
  anularFactura,
  emailFactura,
  getPoliticaDevolucion,
  type PoliticaDevolucion,
} from "@/lib/api/facturas";
import { toastError } from "@/lib/api/errors";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Acciones por factura (handoff fe-devoluciones-lista-y-acciones, slices A–D):
//  Ver/Imprimir → detalle · Editar → detalle (borrador) · Email → POST /facturas/:id/email ·
//  Devolución → PÁGINA COMPLETA /facturacion/:id/devolver (tabla ancha) · Anular → /anular (motivo).
//  Timing: GET /politica-devolucion resalta Anular (mismo día) vs Devolver ("· sugerido").
export function FacturaRowActions({
  facturaId,
  estado,
  centroId,
  onChanged,
}: {
  facturaId: string;
  estado: string;
  centroId?: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("facturacionList.actions");
  const tRoot = useTranslations();
  const router = useRouter();
  const { can } = useCan();

  const [anularOpen, setAnularOpen] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [pol, setPol] = React.useState<PoliticaDevolucion | null>(null);

  const esBorrador = estado === "borrador";
  const esEmitida = estado === "emitida";
  const puedeAnular = esEmitida && can("factura.anular");
  const puedeDevolver = (esEmitida || estado === "devuelta_parcial") && can("factura.devolver");
  const puedeEmail = !esBorrador && can("notificaciones.create");
  const sugerido = pol?.accionSugerida;

  const href = centroId ? `/facturacion/${facturaId}?centro=${centroId}` : `/facturacion/${facturaId}`;
  const devolverHref = centroId ? `/facturacion/${facturaId}/devolver?centro=${centroId}` : `/facturacion/${facturaId}/devolver`;

  function onOpenChange(open: boolean) {
    if (open && !pol && (puedeAnular || puedeDevolver)) {
      getPoliticaDevolucion(facturaId, centroId).then(setPol).catch(() => {});
    }
  }

  async function anular() {
    if (!motivo.trim() || busy) return;
    setBusy(true);
    try {
      await anularFactura(facturaId, motivo.trim(), centroId);
      setAnularOpen(false);
      setMotivo("");
      onChanged?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  const sug = (accion: "anular" | "devolver", label: string) => (sugerido === accion ? `${label} · ${t("suggested")}` : label);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={t("menu")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(href)}>{t("view")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(href)}>{t("print")}</DropdownMenuItem>
          {esBorrador && <DropdownMenuItem onSelect={() => router.push(href)}>{t("edit")}</DropdownMenuItem>}
          {puedeEmail && <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEmailOpen(true); }}>{t("email")}</DropdownMenuItem>}
          {puedeDevolver && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push(devolverHref)}>{sug("devolver", t("return"))}</DropdownMenuItem>
            </>
          )}
          {puedeAnular && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setAnularOpen(true); }}>
                {sug("anular", t("void"))}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={anularOpen} onOpenChange={setAnularOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voidTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("voidBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("voidReason")} aria-label={t("voidReason")} autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={!motivo.trim() || busy} onClick={anular}>{t("void")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {emailOpen && <EmailDialog facturaId={facturaId} centroId={centroId} onClose={() => setEmailOpen(false)} />}
    </div>
  );
}

// Enviar la factura por email (BE PR #106). Sin email → usa el del paciente (el BE 400 si no hay).
function EmailDialog({ facturaId, centroId, onClose }: { facturaId: string; centroId?: string; onClose: () => void }) {
  const t = useTranslations("facturacionList.actions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const [email, setEmail] = React.useState("");
  const [cuerpo, setCuerpo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function enviar() {
    setBusy(true);
    try {
      await emailFactura(facturaId, { ...(email.trim() ? { email: email.trim() } : {}), ...(cuerpo.trim() ? { cuerpo: cuerpo.trim() } : {}) }, centroId);
      toast.success(t("emailSent"));
      onClose();
    } catch (err) {
      toastError(err, tRoot);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("emailTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("emailTo")}</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPatientDefault")} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("emailBody")}</span>
            <Textarea rows={3} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder={t("emailBodyPlaceholder")} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
            <Button size="sm" onClick={enviar} disabled={busy}>{t("emailSend")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
