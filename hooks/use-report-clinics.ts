"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { clinicCoverage } from "@/lib/reports/report-clinics";

/**
 * A report over the clinics the top bar shows (Bayamón / Caguas / Ambos, docs/specs/selector-de-centros-
 * arriba.md), among those where the person holds `permission`. The BE sums the clinics into one figure, so
 * `scopeLabel` names what a total covers ("CMR Caguas" / "2 clinics"). Fetch only once `ready`.
 */
export function useReportClinics(permission: string) {
  const t = useTranslations("reports.clinicScope");
  const filter = useClinicFilter(permission);
  const readable = React.useMemo(() => filter.centers.map((c) => c.id), [filter.centers]);

  const choice = filter.choice;
  const coverage = clinicCoverage(readable, choice);
  // What the figures cover, always (e.g. a printed letterhead, a total's label).
  const coverageText =
    coverage.kind === "one"
      ? filter.nameOf(coverage.id) || t("many", { count: 1 })
      : coverage.kind === "many"
        ? t("many", { count: coverage.count })
        : "";
  const scopeLabel = coverageText || null;

  return {
    choice,
    choiceKey: filter.choiceKey,
    ready: !filter.loading,
    centers: filter.centers,
    noClinic: !filter.loading && filter.centers.length === 0,
    coverageText,
    scopeLabel,
    /** `label` followed by the clinics it covers, e.g. "Totals (2 clinics)". */
    withScope: (label: string) => (scopeLabel ? t("total", { label, scope: scopeLabel }) : label),
  };
}
