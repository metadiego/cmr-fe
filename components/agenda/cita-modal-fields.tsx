"use client";

import { useTranslations } from "next-intl";

import type { Personal } from "@/lib/api/personal";
import { Field } from "@/components/kit/form-dialog";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { StatusBadge } from "@/components/kit/status-badge";
import type { StageLabel } from "@/lib/lifecycle/stage-labels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Centinela "Sin médico" para que el Select nunca quede en vacío (Radix no admite value="").
const NONE_MEDICO = "__sin_medico__";

// The doctor and status fields of CitaModal, split out to keep that file under the 600-line ceiling
// (eslint.config.mjs) once the VISIT_IN_PROGRESS/APPOINTMENT_DATE_IN_PAST handling landed next to it.
export function DoctorField({
  medicoId,
  onChange,
  medicoRequired,
  medicos,
}: {
  medicoId: string;
  onChange: (id: string) => void;
  medicoRequired: boolean;
  medicos: Personal[];
}) {
  const t = useTranslations("agenda.modal");
  return (
    <Field label={t("doctor")} required={medicoRequired}>
      <Select value={medicoId || NONE_MEDICO} onValueChange={(v) => onChange(v === NONE_MEDICO ? "" : v)}>
        <SelectTrigger className="w-full" aria-label={t("doctor")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_MEDICO}>{t("noDoctor")}</SelectItem>
          {medicos.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {[m.name, m.lastName].filter(Boolean).join(" ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// The status of the appointment: on edit, its stage label as a badge; on create, whether it is born
// confirmed (a boolean, `confirmed` on the create door), labelled from lifecycle.label.medical.*.
export function StatusField({
  isEdit,
  editLabel,
  confirmed,
  canConfirm = true,
  onChange,
}: {
  isEdit: boolean;
  /** Edit: the appointment's stage label (null when unknown). */
  editLabel: StageLabel | null;
  /** Create: born confirmed. */
  confirmed: boolean;
  /** Create: false when appointments.confirm is known missing in this clinic (no toggle: born booked). */
  canConfirm?: boolean;
  onChange: (confirmed: boolean) => void;
}) {
  const t = useTranslations("agenda.modal");
  const tRoot = useTranslations();
  const label = (key: "booked" | "confirmed") => tRoot(`lifecycle.label.medical.${key}`);
  return (
    <Field label={t("status")}>
      {isEdit || !canConfirm ? (
        <div className="flex h-9 items-center">
          <StatusBadge kind="medicalStatus" value={isEdit ? editLabel : "booked"} />
        </div>
      ) : (
        <SegmentedControl
          ariaLabel={t("status")}
          value={confirmed ? "confirmed" : "booked"}
          onChange={(v) => onChange(v === "confirmed")}
          options={(["booked", "confirmed"] as const).map((key) => ({ value: key, label: label(key) }))}
        />
      )}
    </Field>
  );
}

/** Several clinics on create: which one books (a toggle up to three, else a list). */
export function ClinicField({
  centros,
  value,
  onChange,
}: {
  centros: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("agenda.modal");
  return (
    <Field label={t("centro")} required>
      {centros.length <= 3 ? (
        <SegmentedControl
          ariaLabel={t("centro")}
          options={centros.map((c) => ({ value: c.id, label: c.name }))}
          value={value}
          onChange={onChange}
        />
      ) : (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("centroPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {centros.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

/**
 * The footer's line: what «Guardar» books. The day and hour in bold (or «Elige una hora» while none is
 * chosen, never a preset hour nobody picked), then the type, doctor and clinic.
 */
export function BookingFooterSummary({ when, rest }: { when: string | null; rest: string }) {
  const t = useTranslations("agenda.modal");
  return (
    <div className="min-w-0 sm:mr-auto">
      <p className={when ? "truncate text-sm font-semibold tabular-nums" : "truncate text-sm text-muted-foreground"}>
        {when ?? t("pickTime")}
      </p>
      {rest && <p className="truncate text-xs text-muted-foreground">{rest}</p>}
    </div>
  );
}
