import { toast } from "sonner";
import type { useTranslations } from "next-intl";

import type { ApiWarning } from "@/lib/api/types";

type RootT = ReturnType<typeof useTranslations>;

// Muestra los avisos NO bloqueantes del BE (meta.warnings, PR #168) como toasts de advertencia.
// Traduce por `labelKey` (con los datos del warning como params ICU: cupo/agendadas/...); si no hay
// clave i18n, cae al `message` del BE o al `code`. Único punto → sin duplicar en cada modal.
export function mostrarAvisos(warnings: ApiWarning[] | undefined, t: RootT): void {
  for (const w of warnings ?? []) {
    const msg =
      w.labelKey && t.has(w.labelKey)
        ? t(w.labelKey, w as unknown as Record<string, string | number>)
        : (w.message ?? w.code);
    toast.warning(msg);
  }
}
