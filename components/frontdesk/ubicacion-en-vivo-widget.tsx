"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon } from "@hugeicons/core-free-icons";

import { getLiveLocation, type PatientLiveLocation } from "@/lib/api/pacientes";
import { claveUbicacion, fechaDesdeValida } from "@/lib/pacientes/ubicacion";
import { useResource } from "@/hooks/use-resource";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Widget fijo (visible sin importar la pestaña de Frontdesk activa): dónde está CADA paciente ahora
// mismo — vitales, consulta, o un servicio específico — en vivo, sin recargar. Pedido del dueño,
// 07-oct-2026: "con nosotros mismos podemos saber si está en vitales, consulta o servicio". El
// stream ya existe (mismo bus que usa toda la app); esto solo le pide al BE la foto resuelta cada
// vez que algo cambia. Handoff: HANDOFF-ubicacion-en-vivo-del-paciente.md.
export function UbicacionEnVivoWidget({
  centroId,
  nombreServicio,
}: {
  centroId?: string;
  // Resuelve un serviceSlug a su nombre visible (la pestaña ya los conoce); sin esto, se pinta el
  // slug crudo — igual de funcional, solo menos bonito.
  nombreServicio?: (slug: string) => string | undefined;
}) {
  const t = useTranslations("frontdesk.ubicacion");
  const format = useFormatter();
  const { state, reload } = useResource<PatientLiveLocation[]>(
    () => (centroId ? getLiveLocation(centroId) : Promise.resolve([])),
    [centroId],
  );
  // Sin filtro de entidad a propósito: un cambio de cita (Atención) O de sesión (cualquier
  // Servicio) puede mover a alguien de ubicación — el widget necesita enterarse de ambos.
  useCitaStream({ centroId: centroId ?? null, enabled: !!centroId, onInvalidate: reload });

  const items = state.kind === "ok" ? state.data : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HugeiconsIcon icon={Location01Icon} className="size-4" />
          {t("titulo")}
          {items.length > 0 && <Badge variant="secondary" className="tabular-nums">{items.length}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto">
        <DropdownMenuLabel>{t("titulo")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{t("vacio")}</p>
        ) : (
          items.map((p) => {
            const clave = claveUbicacion(p);
            const servicio = p.serviceSlug ? (nombreServicio?.(p.serviceSlug) ?? p.serviceSlug) : "";
            const etiqueta = clave === "enServicio" || clave === "enServicioEsperando" ? t(clave, { servicio }) : t(clave);
            const desde = fechaDesdeValida(p.from) ? format.dateTime(new Date(p.from), "time") : null;
            return (
              <div key={p.patientId} className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{p.displayName}</span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  {etiqueta}
                  {desde && <span className="ml-1 tabular-nums">· {desde}</span>}
                </span>
              </div>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
