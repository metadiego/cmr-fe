// The bulk booking answer (POST /frontdesk/sessions/book-multiple). Today the BE answers `creadas` /
// `omitidas` / `aviso`; those keys are missing from the v2 key dictionary, so a later BE translation
// would send `created` / `skipped` / `notice`. The wrapper accepts either and always returns the
// Spanish-named shape the callers use.

export interface BookMultipleResponseRaw<T> {
  creadas?: T[];
  created?: T[];
  omitidas?: number;
  skipped?: number;
  aviso?: unknown;
  notice?: unknown;
}

export function normalizeBookMultiple<T>(
  raw: BookMultipleResponseRaw<T> | null | undefined,
): { creadas: T[]; omitidas: number; aviso: unknown | null } {
  return {
    creadas: raw?.created ?? raw?.creadas ?? [],
    omitidas: raw?.skipped ?? raw?.omitidas ?? 0,
    aviso: raw?.notice ?? raw?.aviso ?? null,
  };
}
