"use client";

import { useTranslations } from "next-intl";

import type { Servicio } from "@/lib/api/servicios";
import { PresentesMarca } from "@/components/frontdesk/presentes-marca";
import type { PresentesPrefs } from "@/lib/presentes-prefs";

// Pestañas por servicio (color del dato); filtradas al paciente si hay filtro. Vacío no queda mudo.
// Extraído de frontdesk-board.tsx para mantener ese archivo bajo su tope de líneas (DEBT,
// eslint.config.mjs). `serviciosVisibles` llega ya filtrado por `citasHoy` desde frontdesk-board.tsx
// (el seleccionado nunca se oculta; sin dato resuelto, todos visibles) — ver el comentario ahí.
export function ServiciosTabs({
  vacioPaciente,
  serviciosVisibles,
  tabEfectivo,
  onPick,
  presentesPorClave,
  presentesPrefs,
  presentesMax,
}: {
  // El paciente filtrado no tiene NINGÚN servicio hoy (antes de aplicar el filtro de actividad):
  // decide el padre (pacienteFiltro && filtroSlugs && serviciosMostrados.length === 0).
  vacioPaciente: boolean;
  serviciosVisibles: Servicio[];
  tabEfectivo: string;
  onPick: (slug: string) => void;
  presentesPorClave: Map<string, number>;
  presentesPrefs: PresentesPrefs;
  presentesMax: number;
}) {
  const t = useTranslations("frontdesk");
  if (vacioPaciente) {
    return (
      <p className="mb-4 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {t("pacienteSinHoy")}
      </p>
    );
  }
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {serviciosVisibles.map((s) => {
        const activo = s.slug === tabEfectivo;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.slug)}
            className={
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm uppercase transition-colors " +
              (activo
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "bg-background text-foreground hover:bg-muted")
            }
          >
            {s.color && (
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            )}
            {s.name}
            {/* Contador de presentes (la burbuja del legado): color solo donde hay gente. */}
            <PresentesMarca presentes={presentesPorClave.get(s.slug) ?? 0} prefs={presentesPrefs} max={presentesMax} />
          </button>
        );
      })}
    </div>
  );
}
