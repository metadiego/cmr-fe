import { toast } from "sonner";
import type { useTranslations } from "next-intl";

import type { ApiWarning } from "@/lib/api/types";

type RootT = ReturnType<typeof useTranslations>;

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
export function mostrarAvisos(warnings: ApiWarning[] | undefined, t: RootT): void {
  for (const w of warnings ?? []) {
    const labelKey = w.labelKey ? (LABEL_KEY_OVERRIDE[w.labelKey] ?? w.labelKey) : undefined;
    const msg =
      labelKey && t.has(labelKey)
        ? t(labelKey, w as unknown as Record<string, string | number>)
        : (w.message ?? w.code);
    toast.warning(msg);
  }
}
