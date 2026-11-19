// Body measurements (scale / tape) — the «Medidas sin vincular» hub (BE #509).
import { apiFetch } from "./client";
import { readUnlinked, type MeasurementKind, type UnlinkedReading } from "@/lib/body-measurements/unlinked";

/** Readings still without a visit since `from` (BE default: 14 days back), in the given centers or every readable one. */
export async function listUnlinkedMeasurements(params: { from?: string; centerIds?: string[] }): Promise<UnlinkedReading[]> {
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.centerIds?.length) sp.set("centerIds", params.centerIds.join(","));
  const qs = sp.toString();
  const rows = await apiFetch<unknown>(`/body-measurements/unlinked${qs ? `?${qs}` : ""}`);
  return (Array.isArray(rows) ? rows : []).map((r) => readUnlinked(r as Record<string, unknown>));
}

/** Links a reading to a visit by hand; it takes that visit's patient and day. 409 bodyMeasurements.error.alreadyLinked. */
export function linkMeasurement(kind: MeasurementKind, id: string, sessionId: string, centerId?: string): Promise<unknown> {
  return apiFetch(
    `/body-measurements/${kind}/${encodeURIComponent(id)}/link`,
    { method: "POST", body: JSON.stringify({ sessionId }) },
    centerId,
  );
}
