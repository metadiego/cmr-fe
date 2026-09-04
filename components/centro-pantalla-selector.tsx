"use client";

import { useTranslations } from "next-intl";

import type { CentroPantalla } from "@/hooks/use-centro-pantalla";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Selector de centro EN la pantalla, uniforme para todos los dominios (citas, calendario, facturación,
// inventario…). No se enseña con un solo centro. Cuando el centro elegido es de solo lectura, muestra el
// distintivo al lado. Handoff selector-de-centro-en-la-pantalla. Ver [[useCentroPantalla]].
export function CentroPantallaSelector({ estado }: { estado: CentroPantalla }) {
  const t = useTranslations("centroSel");
  if (!estado.mostrarSelector) return null;
  return (
    <div className="flex items-center gap-2">
      <Select value={estado.centroActivo} onValueChange={estado.setCentro}>
        <SelectTrigger className="w-48" aria-label={t("label")}><SelectValue /></SelectTrigger>
        <SelectContent>
          {estado.centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {!estado.puedeEscribir && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t("soloLectura")}</span>
      )}
    </div>
  );
}
