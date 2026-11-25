"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { PackageGateCtx } from "@/components/tablero/flujo-atencion";
import type { PatientDay } from "@/lib/frontdesk/patient-day";
import { crearDisponibilidadExcepcional } from "@/lib/api/invoice-packages";
import { missingFields } from "@/lib/forms/missing";
import { useCan } from "@/hooks/use-can";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

// Attending refused for lack of sessions (cmr-be #693, 422 NO_PACKAGE_TO_ATTEND, handoff
// .personal/handoff-asistir-exige-sesiones.md): a BLOCKING dialog with the three ways out, never a
// toast — the same "if there is a gate, paint the dialog" wiring as EhrGateHost
// (components/tablero/ehr-readiness-modal.tsx), one host instead of a copy per board.
export function PackageGateHost({
  gate,
  patient,
  centerId,
  onClose,
}: {
  gate: PackageGateCtx | null;
  patient: PatientDay;
  centerId: string | undefined;
  onClose: () => void;
}) {
  const [exceptional, setExceptional] = React.useState(false);
  const t = useTranslations("frontdesk");
  const { can } = useCan();

  if (!gate) return null;

  function close() {
    setExceptional(false);
    onClose();
  }

  if (exceptional) {
    return (
      <ExceptionalAvailabilityDialog
        gate={gate}
        centerId={centerId}
        onClose={close}
        onDone={() => {
          const onCompleted = gate.onCompleted;
          close();
          onCompleted();
        }}
      />
    );
  }

  const legacyHref = `/patients/legacy-availability?${new URLSearchParams({
    ...(centerId ? { centro: centerId } : {}),
    ...(patient.record ? { record: patient.record } : {}),
  }).toString()}`;

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("no_package.title")}</DialogTitle>
          <DialogDescription>
            {t.has("error.no_package_to_attend")
              ? t("error.no_package_to_attend", { service: gate.service ?? "" })
              : t("no_package.title")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:justify-start">
          {/* "Facturar": lo normal — un primario por región (norma de UI). */}
          <Button asChild className="w-full">
            <Link href={`/patients/${patient.patientId}/billing${centerId ? `?centro=${centerId}` : ""}`}>
              {t("no_package.invoice")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={legacyHref}>{t("no_package.loadLegacy")}</Link>
          </Button>
          {can("frontdesk.availability.exception") && (
            <Button type="button" variant="outline" className="w-full" onClick={() => setExceptional(true)}>
              {t("no_package.exceptional")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExceptionalAvailabilityDialog({
  gate,
  centerId,
  onClose,
  onDone,
}: {
  gate: PackageGateCtx;
  centerId: string | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("frontdesk.exceptional_availability");
  const [form, setForm] = useDialogForm(
    () => ({
      productoId: gate.productOptions.length === 1 ? gate.productOptions[0].value : "",
      sesiones: "1",
      motivo: "",
    }),
    true,
    gate.patientId,
  );

  const motivo = form.motivo.trim();
  // Filled but too short is never "missing" (rule 8): it is a `reason`, never disabling by itself —
  // the BE itself answers 400 under 10 characters.
  const reasonTooShort = motivo.length > 0 && motivo.length < 10;
  const missing = missingFields([
    [t("product"), !!form.productoId],
    [t("sessions"), !!form.sesiones && Number(form.sesiones) >= 1],
    [t("reason"), motivo.length > 0],
  ]);
  const reasonText = reasonTooShort ? t("reasonTooShort") : null;

  const { submitting, submit } = useSubmit(
    () =>
      crearDisponibilidadExcepcional(
        {
          pacienteId: gate.patientId,
          productoId: form.productoId,
          sesiones: Number(form.sesiones),
          motivo,
          centerId,
        },
        centerId,
      ),
    { successMessage: t("saved"), onSuccess: onDone },
  );

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={t("title")}
      onSubmit={() => submit()}
      submitLabel={t("save")}
      submitting={submitting}
      missing={missing}
      blocked={reasonTooShort}
      reason={reasonText}
    >
      <Field label={t("product")} required>
        <Select value={form.productoId || undefined} onValueChange={(v) => setForm({ productoId: v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {gate.productOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("sessions")} required>
        <Input
          type="number"
          min={1}
          max={100}
          value={form.sesiones}
          onChange={(e) => setForm({ sesiones: e.target.value })}
          className="w-24"
        />
      </Field>
      <Field label={t("reason")} required error={reasonText}>
        <Textarea
          value={form.motivo}
          onChange={(e) => setForm({ motivo: e.target.value })}
          rows={2}
          placeholder={t("reasonPlaceholder")}
        />
      </Field>
      <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
        {t("notice")}
      </p>
    </FormDialog>
  );
}
