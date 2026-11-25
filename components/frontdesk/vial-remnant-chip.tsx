"use client";

import { useFormatter, useTranslations } from "next-intl";

import { listPatientOpenVials, type PatientOpenVial } from "@/lib/api/open-vials";
import { remnantsToShow } from "@/lib/frontdesk/vial-remnant";
import { useResource } from "@/hooks/use-resource";

// «Resto del vial n.º 12 · quedan 20 mg» on a vial-service row (cmr-be #700): what the patient still has
// of a vial opened in their name. Expired remnants read amber — the BE will not use them and opens a new one.
// `refreshKey` changes when the row does (attended, dose edited), so the remnant follows the visit.
export function VialRemnantChips({
  patientId,
  productId,
  unit,
  centro,
  refreshKey,
}: {
  patientId: string;
  productId?: string | null;
  unit?: string | null;
  centro?: string;
  refreshKey?: string;
}) {
  const t = useTranslations("frontdesk.vial");
  const format = useFormatter();
  const res = useResource<PatientOpenVial[]>(() => listPatientOpenVials(patientId, centro), [patientId, centro, refreshKey]);
  if (res.state.kind !== "ok") return null;
  const vials = remnantsToShow(res.state.data, productId);
  if (vials.length === 0) return null;
  const u = unit ? ` ${unit}` : "";
  return (
    <span className="inline-flex flex-wrap gap-1">
      {vials.map((v) =>
        v.expired ? (
          <span key={v.openVialId} className="rounded-full bg-warning px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
            {t("expired", { number: v.number ?? "—" })}
          </span>
        ) : (
          <span key={v.openVialId} className="rounded-full bg-info px-2 py-0.5 text-[11px] font-medium text-info-foreground tabular-nums">
            {t("remnant", { number: v.number ?? "—", remaining: `${v.remaining}${u}` })}
            {v.openingExpiresAt && ` · ${t("expires", { day: format.dateTime(new Date(v.openingExpiresAt), "dayMonth") })}`}
          </span>
        ),
      )}
    </span>
  );
}
