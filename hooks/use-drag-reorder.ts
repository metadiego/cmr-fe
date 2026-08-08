"use client";

import * as React from "react";

// Arrastrar-y-soltar para reordenar una lista, ESTÁNDAR de la app (mismos gestos y afordancia en todos
// los editores de columnas de tablero). Devuelve props para cada fila por índice y el índice en arrastre
// (para el realce). El consumidor implementa `onReorder(from, to)` (mover el elemento `from` a la
// posición `to`) y persiste como corresponda. Es agnóstico del contenido: sirve para columnas, bloques
// encadenados o productos escogidos.
export function useDragReorder(onReorder: (from: number, to: number) => void, enabled = true) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const dragProps = React.useCallback(
    (index: number): React.HTMLAttributes<HTMLElement> & { draggable?: boolean } => {
      if (!enabled) return {};
      return {
        draggable: true,
        onDragStart: (e) => {
          setDragIndex(index);
          e.dataTransfer.effectAllowed = "move";
        },
        onDragOver: (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        },
        onDrop: (e) => {
          e.preventDefault();
          setDragIndex((from) => {
            if (from != null && from !== index) onReorder(from, index);
            return null;
          });
        },
        onDragEnd: () => setDragIndex(null),
      };
    },
    [enabled, onReorder],
  );

  // Clase de realce estándar para la fila destino mientras se arrastra (y opacidad de la que se mueve).
  const rowClass = React.useCallback(
    (index: number, active = true): string =>
      (dragIndex === index ? "opacity-40 " : "") +
      (dragIndex != null && dragIndex !== index && active ? "ring-1 ring-primary/40 " : ""),
    [dragIndex],
  );

  return { dragIndex, dragProps, rowClass };
}

// Asa de agarre estándar (glifo braille ⠿). Uso: <span {...gripProps} className={dragGripClass}>⠿</span>
export const DRAG_GRIP = "⠿";
