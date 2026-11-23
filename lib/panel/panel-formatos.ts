import { parseAcciones, type ReportAccion } from "../frontdesk/acciones.ts";

type ServicioConAcciones = { id: string; name: string; formActions?: unknown };

// Which service a panel notice's/work row's visit belongs to: the row only carries the service's
// display name and (BE #663, still rolling out) its id — match by id when present, fall back to
// name while old cached events or a not-yet-updated BE are still in play.
function servicioFor(
  notice: { serviceId?: string | null; serviceName?: string | null },
  servicios: readonly ServicioConAcciones[],
): ServicioConAcciones | undefined {
  return (
    (notice.serviceId && servicios.find((s) => s.id === notice.serviceId)) ||
    servicios.find((s) => s.name === notice.serviceName)
  );
}

// Which on-screen sheet(s) a panel notice's visit can fill, generic per format. `fillableSlugs` is
// whatever GET /formats itself says is fillable (cmr-be #665, fillableSlugsFrom in
// ../format-sheet/sheet.ts) — not every "report" on a service is a screen-fillable sheet (HILT/MLS
// printable formats are not).
export function fillableReportsFor(
  notice: { serviceId?: string | null; serviceName?: string | null },
  servicios: readonly ServicioConAcciones[],
  fillableSlugs: ReadonlySet<string>,
): ReportAccion[] {
  const reports = parseAcciones(servicioFor(notice, servicios)?.formActions).reports ?? [];
  return reports.filter((r) => fillableSlugs.has(r.id));
}

// EVERY report the service declares — fillable sheets AND print-only ones (HILT/MLS, GLP-1's
// adherence sheet) — for a "ver/imprimir" entry point that does not require the on-screen editor.
// Same engine the board's row menu already uses (lib/frontdesk/acciones.ts), just resolved from a
// panel row instead of a frontdesk session: nothing here is specific to any one service or format.
export function reportsFor(
  notice: { serviceId?: string | null; serviceName?: string | null },
  servicios: readonly ServicioConAcciones[],
): ReportAccion[] {
  return parseAcciones(servicioFor(notice, servicios)?.formActions).reports ?? [];
}
