"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { Persistencia } from "@/lib/api/types";

// Toast que CERTIFICA la persistencia (no un 200 "por si acaso"): verde con el valor y la HORA DE LA BASE
// (guardadoEn) cuando la fila releída confirma el dato; rojo + motivo cuando no quedó. Devuelve `ok` para
// que el llamador refresque/revierta a la verdad. Si no viene el bloque (endpoint aún no cubierto), no
// inventa un toast verde. Handoff HANDOFF-toast-que-certifica-la-persistencia.
export function usePersistenciaToast(): (
  p: Persistencia | undefined,
  etiqueta?: string,
) => boolean {
  const t = useTranslations("persistencia");
  return React.useCallback(
    (p, etiqueta) => {
      if (!p) return true; // sin certificado → comportamiento actual (no afirmar de más)
      const key = p.campos ? Object.keys(p.campos)[0] : undefined;
      // Etiqueta humana de la columna; si no llega, la ruta del dato como último recurso (datos.tubos).
      const label = (etiqueta && etiqueta.trim()) || key || "";
      const valor = key && p.campos ? p.campos[key] : undefined;

      if (p.ok) {
        const hora = p.guardadoEn ? horaPR(p.guardadoEn) : "";
        const detalle = label ? `${label}${valor != null && valor !== "" ? ` = ${valor}` : ""}` : "";
        toast.success([t("guardado"), detalle, hora].filter(Boolean).join(" · "));
        return true;
      }

      toast.error([t("noGuardado"), label].filter(Boolean).join(" · "), {
        description: p.motivo || undefined,
      });
      return false;
    },
    [t],
  );
}

// Hora en zona de Puerto Rico (la del negocio), a partir del instante de la base.
function horaPR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-PR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Puerto_Rico",
  }).format(d);
}
