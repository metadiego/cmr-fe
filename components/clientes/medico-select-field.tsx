"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getMedicos, type Personal } from "@/lib/api/personal";
import { useResource } from "@/hooks/use-resource";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

// Selector del médico del paciente en la ficha: asignar / cambiar / quitar. Muestra ya seleccionado
// el médico actual (value = medicoId). El médico ya asignado puede ser de OTRO centro (no está atado
// a un centro): se conserva y se muestra aunque no esté en el catálogo del centro activo, con su
// nombre, para no perderlo al editar. Extraído de paciente-form-sheet (techo de tamaño).
export function MedicoSelectField({
  value,
  onChange,
  centro,
  doctorName,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  centro?: string;
  doctorName?: string | null;
  invalid?: boolean;
}) {
  const t = useTranslations("patients.form");
  const { state } = useResource<Personal[]>(() => getMedicos(centro), [centro]);
  const medicos = state.kind === "ok" ? state.data : [];
  const foraneo =
    value && !medicos.some((m) => m.id === value) ? { id: value, name: doctorName || value } : null;
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder={t("sinMedico")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("sinMedico")}</SelectItem>
        {foraneo && (
          <SelectItem value={foraneo.id}>
            {foraneo.name} · {t("otroCentro")}
          </SelectItem>
        )}
        {medicos.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {[m.name, m.lastName].filter(Boolean).join(" ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
