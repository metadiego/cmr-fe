// The per-service staff tables of «Estadísticas de servicios» (BE #554), as the legacy `stastnursetec`:
// visits, distinct patients and THERAPIES — the areas in laser, the doses in Vit C, one per visit
// elsewhere. Pure helpers; every number comes from the BE.

type Row = { participaciones: number; therapies?: number | null };

/** The «Terapias» column is shown only where it says something visits don't (laser areas, Vit C doses). */
export function showTherapies(rows: readonly Row[]): boolean {
  return rows.some((r) => r.therapies != null && r.therapies !== r.participaciones);
}

/** Is there a «Vitales» tab to draw? (vitals taken by the nurses at medical appointments) */
export function hasVitals(v: { rows?: readonly unknown[] } | null | undefined): boolean {
  return Array.isArray(v?.rows) && v.rows.length > 0;
}

/**
 * «Estadísticas Diarias» (BE #563): a row shows «{visits} pac. / {therapies} u.» ONLY for the
 * service(s) that declared a `statisticsUnitKey` (GET /services, owner's call, 11-nov — NEVER by
 * name/slug: laser areas differ from visits too, but that split would confuse there, so it stays
 * one number like before #563). Everything else keeps showing ONE number: `therapies` (areas for
 * laser, the old `applied` semantics — see EstDiariaServicio in lib/api/estadisticas.ts).
 */
export function dailyRowShowsUnits(slug: string, slugsWithUnitKey: ReadonlySet<string>): boolean {
  return slugsWithUnitKey.has(slug);
}
