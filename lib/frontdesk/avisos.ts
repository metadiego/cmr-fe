import { toast } from "sonner";
import type { useFormatter, useTranslations } from "next-intl";

import type { ApiWarning } from "@/lib/api/types";
import { parseDayUTC } from "@/lib/format/fecha";

type RootT = ReturnType<typeof useTranslations>;
type RootFormat = ReturnType<typeof useFormatter>;

// El BE reusa `sheet.unavailable` para dos cosas distintas: el 503 que bloquea (nada se agendó) Y,
// con `sheetDownPolicy: 'allow'`, el aviso no bloqueante (sí se agendó, solo sin asiento en la hoja).
// Aquí SIEMPRE es el segundo caso — se remapea a su propia clave para no decir "no se agendó" de
// algo que sí se guardó. Handoff .personal/handoff-hoja-caida-avisar-o-bloquear.md.
const LABEL_KEY_OVERRIDE: Record<string, string> = {
  "sheet.unavailable": "sheet.unavailableWarn",
};

// Muestra los avisos NO bloqueantes del BE (meta.warnings, PR #168) como toasts de advertencia.
// Traduce por `labelKey` (con los datos del warning como params ICU: cupo/agendadas/...); si no hay
// clave i18n, cae al `message` del BE o al `code`. Único punto → sin duplicar en cada modal.
// `format`: solo lo necesita APPOINTMENT_MOVED_OFF_CLOSED_DAY (handoff-citas-domingos-y-feriados),
// para pintar `from`/`to` como día de calendario, no como ISO crudo — opcional para no romper
// llamadas existentes que no lo pasan.
export function mostrarAvisos(warnings: ApiWarning[] | undefined, t: RootT, format?: RootFormat): void {
  for (const w of warnings ?? []) toast.warning(warningText(w, t, format));
}

/** One BE warning as text (its i18n label, else the BE message, else the code). */
export function warningText(w: ApiWarning, t: RootT, format?: RootFormat): string {
  if (w.code === "APPOINTMENT_MOVED_OFF_CLOSED_DAY" && format) {
    const dayText = (iso: unknown) => {
      const d = typeof iso === "string" ? parseDayUTC(iso) : null;
      return d ? format.dateTime(d, "dayWeekdayShort") : String(iso ?? "");
    };
    const reason = typeof w.reason === "string" ? w.reason : "";
    return t("citas.movedOffClosedDay", {
      from: dayText(w.from),
      to: dayText(w.to),
      reason: t.has(`citas.quickDateReason.${reason}`) ? t(`citas.quickDateReason.${reason}`) : reason,
    });
  }
  const labelKey = w.labelKey ? (LABEL_KEY_OVERRIDE[w.labelKey] ?? w.labelKey) : undefined;
  return labelKey && t.has(labelKey)
    ? t(labelKey, w as unknown as Record<string, string | number>)
    : (w.message ?? w.code);
}
