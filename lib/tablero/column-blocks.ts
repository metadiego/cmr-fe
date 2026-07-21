// Helpers PUROS para columnas ENCADENADAS por `group` en el editor de tableros. Fuente de verdad del
// encadenamiento = `render.group` del BE (dato, nunca claves fijas en el FE). El BE ya garantiza la
// integridad al guardar (PR #124); esto es solo la UX del editor: mover un miembro mueve el bloque entero.
// Genérico sobre cualquier fila con `group?: string | null` → sin acoplar al tipo Row del editor.

export type WithGroup = { group?: string | null };

export type ColumnBlock<T extends WithGroup> = {
  // group del bloque (null = fila suelta, su propio bloque de 1).
  group: string | null;
  items: T[];
};

// Colapsa filas CONTIGUAS con el mismo group no-nulo en un bloque; cada fila sin grupo es su propio bloque.
export function toBlocks<T extends WithGroup>(rows: T[]): ColumnBlock<T>[] {
  const blocks: ColumnBlock<T>[] = [];
  for (const row of rows) {
    const g = row.group ?? null;
    const last = blocks[blocks.length - 1];
    if (g !== null && last && last.group === g) {
      last.items.push(row);
    } else {
      blocks.push({ group: g, items: [row] });
    }
  }
  return blocks;
}

// Mueve un bloque completo una posición (dir -1 arriba, +1 abajo). Respeta límites (no-op fuera de rango).
export function moveBlock<T extends WithGroup>(
  blocks: ColumnBlock<T>[],
  index: number,
  dir: -1 | 1,
): ColumnBlock<T>[] {
  const j = index + dir;
  if (index < 0 || index >= blocks.length || j < 0 || j >= blocks.length) return blocks;
  const next = blocks.slice();
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

// Reexpande los bloques a filas planas (para persistir con orden = índice).
export function flatten<T extends WithGroup>(blocks: ColumnBlock<T>[]): T[] {
  return blocks.flatMap((b) => b.items);
}

// Defensivo/idempotente: junta los miembros de un grupo partido en la 1ª aparición del grupo. Preserva el
// orden relativo dentro del grupo y de las filas sueltas. Útil al construir filas desde datos no contiguos.
export function normalize<T extends WithGroup>(rows: T[]): T[] {
  const order: string[] = []; // grupos (y marcador de sueltas) en orden de 1ª aparición
  const byGroup = new Map<string, T[]>();
  const loose: { at: number; row: T }[] = [];

  rows.forEach((row) => {
    const g = row.group ?? null;
    if (g === null) {
      loose.push({ at: order.length, row });
      order.push(`__loose_${loose.length - 1}`);
      return;
    }
    if (!byGroup.has(g)) {
      byGroup.set(g, []);
      order.push(g);
    }
    byGroup.get(g)!.push(row);
  });

  const out: T[] = [];
  order.forEach((key) => {
    if (key.startsWith("__loose_")) {
      out.push(loose[Number(key.slice("__loose_".length))].row);
    } else {
      out.push(...(byGroup.get(key) ?? []));
    }
  });
  return out;
}
