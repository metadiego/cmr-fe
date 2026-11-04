"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { clinicCoverage, reportClinicChoice, reportFilterSelection } from "@/lib/reports/report-clinics";

/**
 * A report over "every clinic I can read + a filter" (handoff clinic-read-scope). Wraps `useClinicFilter`
 * so a `?centro=` link preselects that clinic until the filter is touched. The BE sums the clinics into one
 * figure, so `scopeLabel` names what a total covers ("CMR Caguas" / "2 clinics"); it is null for someone who
 * reads a single clinic, whose screen stays as it was. Fetch only once `ready`, so a link never shows the
 * all-clinics figure first.
 */
export function useReportClinics(permission: string) {
  const t = useTranslations("reports.clinicScope");
  const urlCenter = useSearchParams().get("centro");
  const filter = useClinicFilter(permission);
  const [touched, setTouched] = React.useState(false);
  const readable = React.useMemo(() => filter.centers.map((c) => c.id), [filter.centers]);

  const choice = reportClinicChoice(readable, filter.selected, urlCenter, touched);
  const coverage = clinicCoverage(readable, choice);
  // What the figures cover, always (e.g. a printed letterhead); `scopeLabel` only for a multi-clinic reader.
  const coverageText =
    coverage.kind === "one"
      ? filter.nameOf(coverage.id) || t("many", { count: 1 })
      : coverage.kind === "many"
        ? t("many", { count: coverage.count })
        : "";
  const scopeLabel = filter.showColumn && coverageText ? coverageText : null;

  return {
    choice,
    choiceKey: choice ? choice.join(",") : "all",
    ready: !filter.loading,
    showFilter: filter.showFilter,
    centers: filter.centers,
    selected: reportFilterSelection(readable, filter.selected, urlCenter, touched),
    onChange: (next: string[] | null) => {
      setTouched(true);
      filter.setSelected(next);
    },
    noClinic: !filter.loading && filter.centers.length === 0,
    coverageText,
    scopeLabel,
    /** `label` followed by the clinics it covers, e.g. "Totals (2 clinics)"; unchanged for a one-clinic reader. */
    withScope: (label: string) => (scopeLabel ? t("total", { label, scope: scopeLabel }) : label),
  };
}
