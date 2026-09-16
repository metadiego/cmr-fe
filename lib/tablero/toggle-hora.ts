import type { Transicion } from "@/lib/api/tablero";

export type EstadoLite = { clave: string; orden: number };

export type ToggleResuelto = {
  checked: boolean;
  canCheck: boolean;
  canUncheck: boolean;
  disabled: boolean;
  // La acción a ejecutar si se pulsa AHORA. `null` = no-op: la casilla no debe hacer nada.
  action: string | null;
};

// Decide qué hace una casilla del flujo de Atención (PRESENTE / EN CONSULTA / ASISTIDO) SIN React,
// para poder probarlo. Reglas (bug atencion-la-segunda-casilla-deshace-la-primera):
//   1. El "atrás" es el reverso de la ETAPA DE ESTA CASILLA (`forward.toStatus`), NO una transición
//      cualquiera que baje desde el estado de la FILA. Antes «En consulta» (fila en `presente`)
//      calculaba `back = volver_confirmada` — el back de «Presente» — y deshacía la llegada.
//   2. Solo se manda `back` cuando esta casilla es la ÚLTIMA etapa activa (`estado === forward.toStatus`).
//      Así, si por un glitch de render la casilla se evalúa `checked`, NUNCA dispara el back de otra etapa.
export function resolveToggle(params: {
  estado: string;
  forwardSlug: string | undefined;
  transiciones: Transicion[];
  estados: EstadoLite[];
  optimistic?: boolean;
  busy?: boolean;
}): ToggleResuelto {
  const { estado, forwardSlug, transiciones, estados, optimistic, busy } = params;
  const ordenOf = (clave: string | null) =>
    estados.find((e) => e.clave === clave)?.orden ?? 0;

  const forward = forwardSlug
    ? transiciones.find((t) => t.slug === forwardSlug)
    : undefined;
  const destino = forward?.toStatus ?? null;

  // MARCADO = el paciente ya alcanzó (o pasó) el destino de ESTA acción.
  const baseChecked = !!forward && destino != null && ordenOf(estado) >= ordenOf(destino);
  const checked = optimistic ?? baseChecked;

  // Reverso de ESTA etapa: transición que SALE del destino de esta casilla y BAJA de estado.
  const back =
    forward && destino != null
      ? transiciones.find(
          (t) =>
            t.fromStatuses.includes(destino) &&
            t.toStatus != null &&
            ordenOf(t.toStatus) < ordenOf(destino),
        )
      : undefined;

  const canCheck =
    !checked &&
    !!forward &&
    (forward.fromStatuses.length === 0 || forward.fromStatuses.includes(estado));
  // LIFO: solo se desmarca la ÚLTIMA etapa activa (estado === destino de esta casilla).
  const isLast = !!forward && estado === destino;
  const canUncheck = checked && isLast && !!back;
  const disabled = !!busy || (!checked && !canCheck) || (checked && !canUncheck);

  // La acción se RECOMPUTA aquí (no "checked ? back : forward" a secas): una casilla que no puede ni
  // avanzar ni deshacer es no-op, jamás manda el back de una etapa que no es la suya.
  const action = checked
    ? canUncheck
      ? (back?.slug ?? null)
      : null
    : canCheck
      ? (forward?.slug ?? null)
      : null;

  return { checked, canCheck, canUncheck, disabled, action };
}
