"use client";

import { cn } from "@/lib/utils";
import { PRESENTES_COLOR_CSS, type PresentesPrefs } from "@/lib/presentes-prefs";

// Indicador de PRESENTES de UN servicio, con los cuatro modos del prototipo (punto/presion/tramos/
// burbuja) y las preferencias. El color aparece SOLO donde hay gente; el vacío va en gris y sin latido.
// Las cifras en Geist Mono con tabular-nums para que no bailen. Handoff presentes-por-servicio.
const VACIO = "var(--muted-foreground)";

// Clase de la figura elegida (circulo/cuadrado/barra) para los modos que dibujan una marca.
function figuraClase(figura: PresentesPrefs["figura"]): string {
  if (figura === "cuadrado") return "rounded-[3px]";
  if (figura === "barra") return "rounded-[1px] !h-1 !w-3";
  return "rounded-full"; // circulo
}

export function PresentesMarca({
  presentes,
  prefs,
  max = 1,
}: {
  presentes: number;
  prefs: PresentesPrefs;
  max?: number; // mayor conteo de la barra, para escalar `presion`/`tramos`
}) {
  const hay = presentes > 0;
  // ocultarVacios: no dibujar nada donde no hay gente (la pestaña sigue ahí para navegar).
  if (!hay && prefs.ocultarVacios) return null;

  const color = hay ? PRESENTES_COLOR_CSS[prefs.color] : VACIO;
  const late = hay && prefs.latido;
  const numero = prefs.verNumeros ? (
    <span className="font-mono text-[11px] tabular-nums leading-none" style={{ color }}>{presentes}</span>
  ) : null;

  // PUNTO — lo más discreto: una figura que late donde hay alguien.
  if (prefs.modo === "punto") {
    return (
      <span className="inline-flex items-center gap-1" aria-label={String(presentes)}>
        <span
          className={cn("inline-block size-2 shrink-0", figuraClase(prefs.figura), late && "animate-pulse")}
          style={{ backgroundColor: color }}
          aria-hidden
        />
        {numero}
      </span>
    );
  }

  // PRESION — pastilla con el número y una línea que se llena según cuánta gente espera.
  if (prefs.modo === "presion") {
    const pct = Math.max(0, Math.min(1, max > 0 ? presentes / max : 0));
    return (
      <span
        className={cn("inline-flex flex-col items-center gap-0.5 rounded-full px-2 py-0.5", late && "animate-pulse")}
        style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
      >
        {prefs.verNumeros && <span className="font-mono text-[11px] tabular-nums leading-none" style={{ color }}>{presentes}</span>}
        <span className="h-0.5 w-6 overflow-hidden rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 25%, transparent)` }}>
          <span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
        </span>
      </span>
    );
  }

  // TRAMOS — un tramo por paciente: se lee de un vistazo sin la cifra. Se topa para no romper la barra.
  if (prefs.modo === "tramos") {
    const n = Math.min(presentes, Math.max(max, 1), 8);
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-[2px]" aria-label={String(presentes)}>
          {Array.from({ length: Math.max(n, 1) }).map((_, i) => (
            <span
              key={i}
              className={cn("inline-block h-2.5 w-[3px] rounded-[1px]", late && "animate-pulse")}
              style={{ backgroundColor: hay ? color : VACIO, opacity: hay ? 1 : 0.5 }}
              aria-hidden
            />
          ))}
        </span>
        {numero}
      </span>
    );
  }

  // BURBUJA — como el legado: la cifra en una píldora, para quien quiera lo de siempre.
  return (
    <span
      className={cn(
        "inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums leading-none",
        late && "animate-pulse",
      )}
      style={{ backgroundColor: color, color: "var(--primary-foreground, #fff)" }}
      aria-label={String(presentes)}
    >
      {presentes}
    </span>
  );
}
