"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useMe } from "@/hooks/use-me";
import { getMyCentrosOperativos, type Centro } from "@/lib/api/centers";
import { getMyPreferences } from "@/lib/api/preferences";
import { getActiveCentro, setActiveCentro } from "@/lib/tenant";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Active-center picker del NAV = «en qué centro estoy trabajando» (cambia el contexto de facturar/
// cobrar/agendar). Fija la cookie X-Tenant-ID y recarga para que todo pida bajo el nuevo tenant. Ofrece
// SOLO los centros OPERATIVOS (donde la persona tiene un rol), no todos los asignados: un acceso puntual
// (p.ej. leer el calendario ajeno) no debe invitar a mudarse allí. Uno solo → no se enseña. Handoff
// calendario-selector-de-centro §«El selector del NAV es OTRA cosa».
export function CenterSelector() {
  const me = useMe();
  const t = useTranslations("nav");
  const [centros, setCentros] = React.useState<Centro[]>([]);
  // Acento de color por centro (spec acento-de-color-por-centro): un punto de color junto al nombre
  // del centro para que el usuario multi-centro sepa de un vistazo en cuál está parado. Sale del motor
  // de preferencias por capas (effective.colorPorCentro); default del sistema Bayamón azul/Caguas verde.
  const [colores, setColores] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (me.kind !== "ok") return;
    let active = true;
    getMyCentrosOperativos()
      .then((list) => active && setCentros(list))
      .catch((err) => active && toast.error(apiErrorMessage(err)));
    getMyPreferences()
      .then((p) => active && setColores(p.effective?.colorPorCentro ?? {}))
      .catch(() => {}); // el acento es apoyo, no bloquea el switcher si falla
    return () => {
      active = false;
    };
  }, [me.kind]);

  // Se enseña solo si hay MÁS DE UN centro operativo — con uno no hay nada que elegir.
  if (centros.length <= 1) return null;

  const current =
    getActiveCentro() ??
    (me.kind === "ok" ? me.me.activeClinicId : null) ??
    "";
  const dot = (id: string) =>
    colores[id] ? (
      <span
        aria-hidden
        className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
        style={{ backgroundColor: colores[id] }}
      />
    ) : null;

  function onChange(id: string) {
    setActiveCentro(id);
    // Full reload so all in-flight components refetch under the new tenant.
    window.location.reload();
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-40 gap-2" aria-label={t("center")}>
        {/* No pintamos el punto aquí: SelectValue ya replica el contenido de la opción activa
            (que incluye su punto). Pintarlo también duplicaría el acento en el trigger. */}
        <SelectValue placeholder={t("center")} />
      </SelectTrigger>
      <SelectContent>
        {centros.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              {dot(c.id)}
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
