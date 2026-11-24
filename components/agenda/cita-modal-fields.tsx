"use client";

import { useTranslations } from "next-intl";

import type { EstadoCitaCatalogo } from "@/lib/api/citas";
import type { Personal } from "@/lib/api/personal";
import { Field } from "@/components/kit/form-dialog";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { Badge } from "@/components/ui/badge";
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

export function StatusField({
  isEdit,
  estadoDef,
  estadosMap,
  estadoCrear,
  onChange,
}: {
  isEdit: boolean;
  estadoDef: EstadoCitaCatalogo | undefined;
  estadosMap: Map<string, EstadoCitaCatalogo>;
  estadoCrear: "programada" | "confirmada";
  onChange: (v: "programada" | "confirmada") => void;
}) {
  const t = useTranslations("agenda.modal");
  const tRoot = useTranslations();
  return (
    <Field label={t("status")}>
      {isEdit ? (
        <div className="flex h-9 items-center">
          <Badge
            variant="secondary"
            style={estadoDef ? { backgroundColor: `${estadoDef.color}20`, color: estadoDef.color } : undefined}
          >
            {estadoDef ? tRoot(estadoDef.labelKey) : t("statusScheduled")}
          </Badge>
        </div>
      ) : (
        <SegmentedControl
          ariaLabel={t("status")}
          value={estadoCrear}
          onChange={onChange}
          options={(["programada", "confirmada"] as const).map((key) => {
            const d = estadosMap.get(key);
            return { value: key, label: d ? tRoot(d.labelKey) : key, dot: d?.color };
          })}
        />
      )}
    </Field>
  );
}
