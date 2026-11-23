"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Can } from "@/components/kit/can";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
import type { Paciente } from "@/lib/api/pacientes";

// Patient search plus a «New patient» button: the sheet opens over the booking dialog, so saving a
// new patient selects it (through the same `onChange` as a search pick) and nothing else is lost.
export function PatientPickerWithCreate({
  id,
  value,
  onChange,
  centerIds,
}: {
  id?: string;
  value: Paciente | null;
  onChange: (p: Paciente | null) => void;
  centerIds?: string[];
}) {
  const t = useTranslations("appointmentsBooking.whosCalling");
  const [newOpen, setNewOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      <PacienteSelect id={id} value={value} onChange={onChange} centerIds={centerIds} />
      {!value && (
        <Can permiso="pacientes.create">
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setNewOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            {t("newPatient")}
          </Button>
        </Can>
      )}
      {/* Mounted only while open: the sheet reads the user's centers and settings when it mounts. */}
      {newOpen && (
        <Can permiso="pacientes.create">
          <PacienteFormSheet
            open
            onOpenChange={setNewOpen}
            onSaved={(saved) => {
              setNewOpen(false);
              onChange(saved);
            }}
          />
        </Can>
      )}
    </div>
  );
}
