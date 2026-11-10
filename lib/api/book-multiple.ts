// cmr-be#524 (f63a4e31, 2026-11-10) tradujo la respuesta de POST /frontdesk/sessions/book-multiple en
// /api/v2: creadas→created, omitidas→skipped, aviso→notice. Se lee con `created ?? creadas` etc. para
// no romper mientras conviven despliegues, y para que el resto del FE siga usando los nombres
// `creadas`/`omitidas`/`aviso` de siempre sin tocar cada consumidor. Sin imports a propósito: Node
// resuelve el grafo entero de un módulo al testearlo, y lib/api/client.ts no se puede testear así.
export type BookMultipleResult<Sesion = unknown> = { creadas: Sesion[]; omitidas: number; aviso: unknown | null };
export type BookMultipleResultRaw<Sesion = unknown> = {
  created?: Sesion[];
  creadas?: Sesion[];
  skipped?: number;
  omitidas?: number;
  notice?: unknown;
  aviso?: unknown;
};
export function normalizeBookMultipleResult<Sesion = unknown>(
  raw: BookMultipleResultRaw<Sesion> | null | undefined,
): BookMultipleResult<Sesion> {
  return {
    creadas: raw?.created ?? raw?.creadas ?? [],
    omitidas: raw?.skipped ?? raw?.omitidas ?? 0,
    aviso: raw?.notice ?? raw?.aviso ?? null,
  };
}
