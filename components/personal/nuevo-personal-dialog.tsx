"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { createPersonal } from "@/lib/api/personal";
import { createClinicReady } from "@/lib/create-clinic";
import { missingFields } from "@/lib/forms/missing";
import { isClinicViewAll } from "@/lib/tenant";
import { Input } from "@/components/ui/input";
import { CreateClinicField } from "@/components/kit/create-clinic-field";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";

// New staff record (handoff personal-crud-completo): only the first name is required; the rest (color, job
// title, sex, clinics…) is filled in on the record after creating it. CLINICS are assigned on the record
// because the BE requires its own endpoint for them. Returns the created id so the caller can select it.
// The record is born in ONE clinic (its home clinic, sent as X-Tenant-ID): `defaultClinicId` from
// hooks/use-create-clinic.ts, switchable among `centers` (where the viewer holds personal.create).
export function NuevoPersonalDialog({
  centers,
  defaultClinicId,
  showClinic,
  onClose,
  onCreated,
}: {
  centers: { id: string; name: string }[];
  defaultClinicId: string;
  /** The screen shows more than one clinic: always say which clinic the person is created in. */
  showClinic: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const [name, setName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [picked, setPicked] = React.useState("");
  const centro = picked || defaultClinicId || undefined;
  // On «Ambos» `defaultClinicId` is empty: nothing is sent until a clinic is picked (lib/create-clinic.ts).
  const clinicReady = createClinicReady(centro ?? "", centers.length, isClinicViewAll());
  // The clinic counts as a missing field only where a picker is shown; otherwise the list is still loading.
  const clinicPicker = centers.length > 1;

  const missing = missingFields([
    [t("nombre"), !!name.trim()],
    [tRoot("createClinic.label"), clinicReady || !clinicPicker],
  ]);
  const clinicsLoading = !clinicReady && !clinicPicker;

  const { submitting, submit } = useSubmit(
    () => createPersonal({ name: name.trim(), lastName: lastName.trim() || null }, centro),
    { successMessage: t("creado"), onSuccess: (creada) => onCreated(creada.id) },
  );

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("nuevo")}
      description={t("nuevoAyuda")}
      missing={missing}
      blocked={clinicsLoading}
      reason={clinicsLoading ? tRoot("common.loading") : null}
      submitting={submitting}
      submitLabel={t("crear")}
      submittingLabel={t("guardando")}
      onSubmit={() => submit()}
    >
      <Field label={t("nombre")} htmlFor="np-nombre" required>
        <Input id="np-nombre" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t("apellido")} htmlFor="np-apellido">
        <Input id="np-apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </Field>
      <CreateClinicField
        centers={centers}
        value={centro ?? ""}
        onChange={setPicked}
        show={showClinic}
        disabled={submitting}
        required
      />
    </FormDialog>
  );
}
