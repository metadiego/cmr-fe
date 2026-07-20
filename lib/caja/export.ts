// Helper PURO para exportar a CSV (abre en Excel). Sin I/O ni React → testeable con `node --test`.
// El armado de filas vive en el componente (datos del BE); aquí solo el serializado seguro.
// See docs/specs/2026-07-20-cuadre-caja-design.md.

/** Escapa un valor para CSV: entre comillas si tiene coma, comilla o salto; duplica comillas. */
function celda(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serializa una matriz de filas a texto CSV (CRLF entre filas, estándar Excel). */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return rows.map((r) => r.map(celda).join(",")).join("\r\n");
}
