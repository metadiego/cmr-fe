"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getNextAvailableDate } from "@/lib/api/disponibilidad";
import { useResource } from "@/hooks/use-resource";

// Aviso REUSABLE de disponibilidad al agendar: pregunta `next-available-date` para el médico y la fecha
// elegidos; si la fecha NO sirve, explica el motivo (labelKey del BE) y ofrece la próxima válida en un
// clic. No bloquea: el usuario decide (regla del BE). Se usa en Nueva cita, Agregar cita y call-center,
// para no duplicar. Handoff agenda-dias-bloqueados-por-medico / ficha-del-medico-hub.
export function AvisoDisponibilidad({
  doctorId,
  date,
  centro,
  onUseSuggested,
}: {
  doctorId?: string;
  date?: string;
  centro?: string;
  onUseSuggested?: (d: string) => void;
}) {
  const t = useTranslations("citas.disponibilidad");
  const tRoot = useTranslations();
  // Debounce la consulta (cambia con cada tecla de fecha / selección de médico).
  const [q, setQ] = React.useState<{ doctorId?: string; date?: string }>({});
  React.useEffect(() => {
    const h = setTimeout(() => setQ({ doctorId, date }), 300);
    return () => clearTimeout(h);
  }, [doctorId, date]);

  const { state } = useResource(
    () => (q.doctorId && q.date ? getNextAvailableDate(q.doctorId, q.date, centro) : Promise.resolve(null)),
    [q.doctorId, q.date, centro],
  );
  const info = state.kind === "ok" ? state.data : null;
  if (!info || !info.moved) return null; // fecha sirve (o aún no hay médico/fecha): nada que avisar

  const motivo = info.labelKey && tRoot.has(info.labelKey) ? tRoot(info.labelKey) : (info.reason ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/40 px-3 py-2 text-sm text-warning-foreground">
      <span>{motivo}.</span>
      {info.exhausted || !info.date ? (
        <span className="text-muted-foreground">{t("noSlot")}</span>
      ) : (
        <>
          <span className="text-muted-foreground">{t("suggested")}: {info.date}</span>
          {onUseSuggested && (
            <button
              type="button"
              onClick={() => onUseSuggested(info.date!)}
              className="ml-auto rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80"
            >
              {t("useSuggested")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
