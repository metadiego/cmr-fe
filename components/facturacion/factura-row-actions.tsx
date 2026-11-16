"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import { anularFactura, emailFactura } from "@/lib/api/facturas";
import { voidReasonMissing } from "@/lib/facturacion/void-reason-missing";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { EmailInput } from "@/components/email-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";

// Acciones por factura (handoff fe-devoluciones-lista-y-acciones, slices A–D):
//  Ver/Imprimir → detalle · Editar → detalle (borrador) · Email → POST /facturas/:id/email ·
//  Devolución → PÁGINA COMPLETA /billing/invoices/:id/return (tabla ancha) · Anular → /anular (motivo).
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
  const router = useRouter();
  const { can } = useCan();

  const [anularOpen, setAnularOpen] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [{ motivo }, setForm] = useDialogForm(() => ({ motivo: "" }), anularOpen);
  const missing = voidReasonMissing({ reason: motivo }).map(() => t("voidReason"));

  const esBorrador = estado === "borrador";
  const esEmitida = estado === "emitida";
  const puedeAnular = esEmitida && can("factura.anular");
  const puedeDevolver = (esEmitida || estado === "devuelta_parcial") && can("factura.devolver");
  const puedeEmail = !esBorrador && can("notificaciones.create");

  const href = centroId ? `/billing/invoices/${facturaId}?centro=${centroId}` : `/billing/invoices/${facturaId}`;
  const devolverHref = centroId ? `/billing/invoices/${facturaId}/return?centro=${centroId}` : `/billing/invoices/${facturaId}/return`;

  const { submitting, submit } = useSubmit(() => anularFactura(facturaId, motivo.trim(), centroId), {
    onSuccess: () => {
      setAnularOpen(false);
      onChanged?.();
    },
  });

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
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
              <DropdownMenuItem onSelect={() => router.push(devolverHref)}>{t("return")}</DropdownMenuItem>
            </>
          )}
          {puedeAnular && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setAnularOpen(true); }}>
                {t("void")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <FormDialog
        open={anularOpen}
        onOpenChange={setAnularOpen}
        size="md"
        title={t("voidTitle")}
        description={t("voidBody")}
        onSubmit={() => submit()}
        actions={[{ label: t("void"), variant: "destructive", onClick: () => submit() }]}
        submitting={submitting}
        missing={missing}
      >
        <Field label={t("voidReason")} htmlFor={`void-invoice-reason-${facturaId}`} required>
          <Input
            id={`void-invoice-reason-${facturaId}`}
            value={motivo}
            onChange={(e) => setForm({ motivo: e.target.value })}
            // Voiding is irreversible: a habitual Enter after typing the reason must not fire it.
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder={t("voidReason")}
            autoFocus
          />
        </Field>
      </FormDialog>

      {emailOpen && <EmailDialog facturaId={facturaId} centroId={centroId} onClose={() => setEmailOpen(false)} />}
    </div>
  );
}

// Send the invoice by email (BE PR #106). No address → the patient's is used (the BE answers 400 if there is none).
// Every field is optional, so nothing is ever missing.
function EmailDialog({ facturaId, centroId, onClose }: { facturaId: string; centroId?: string; onClose: () => void }) {
  const t = useTranslations("facturacionList.actions");
  // Mounted only while open (the parent renders it conditionally), so plain state starts clean every time.
  const [email, setEmail] = React.useState("");
  const [cuerpo, setCuerpo] = React.useState("");

  const { submitting, submit } = useSubmit(
    () =>
      emailFactura(
        facturaId,
        { ...(email.trim() ? { email: email.trim() } : {}), ...(cuerpo.trim() ? { cuerpo: cuerpo.trim() } : {}) },
        centroId,
      ),
    { successMessage: t("emailSent"), onSuccess: () => onClose() },
  );

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("emailTitle")}
      onSubmit={() => submit()}
      submitLabel={t("emailSend")}
      submitting={submitting}
    >
      <Field label={t("emailTo")} htmlFor={`invoice-email-to-${facturaId}`}>
        <EmailInput
          id={`invoice-email-to-${facturaId}`}
          value={email}
          onValueChange={setEmail}
          placeholder={t("emailPatientDefault")}
        />
      </Field>
      <Field label={t("emailBody")} htmlFor={`invoice-email-body-${facturaId}`}>
        <Textarea
          id={`invoice-email-body-${facturaId}`}
          rows={3}
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          placeholder={t("emailBodyPlaceholder")}
        />
      </Field>
    </FormDialog>
  );
}
