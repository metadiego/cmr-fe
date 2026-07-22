// Helpers PUROS de búsqueda del frontdesk: matching insensible a acentos/mayúsculas sobre los textos
// visibles de la fila (nombre) y claves del paciente (record/teléfono resueltos aparte vía buscar-paciente).

export function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// true si la query (normalizada) aparece en ALGUNO de los campos. Query vacía = coincide con todo.
export function coincide(campos: (string | null | undefined)[], query: string): boolean {
  const q = normaliza(query ?? "");
  if (!q) return true;
  return campos.some((c) => !!c && normaliza(String(c)).includes(q));
}
