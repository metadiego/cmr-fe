import { parseAcciones, type ReportAccion } from "../frontdesk/acciones.ts";
import { isFillableSheet } from "../format-sheet/sheet.ts";

// Which on-screen sheet(s) a panel notice's visit can fill, generic per format: the notice only
// carries the service's display name and (BE #663, still rolling out) its id — match by id when
// present, fall back to name while old cached events or a not-yet-updated BE are still in play.
// Only FILLABLE_SHEETS reports count (not every "report" on a service is a screen-fillable sheet —
// HILT/MLS printable formats are not).
export function fillableReportsFor(
  notice: { serviceId?: string | null; serviceName?: string | null },
  servicios: readonly { id: string; name: string; formActions?: unknown }[],
): ReportAccion[] {
  const serv =
    (notice.serviceId && servicios.find((s) => s.id === notice.serviceId)) ||
    servicios.find((s) => s.name === notice.serviceName);
  return (parseAcciones(serv?.formActions).reports ?? []).filter((r) => isFillableSheet(r.id));
}
