"use client";

import { useTranslations } from "next-intl";

import type { CallcenterPbx } from "@/lib/comunicaciones/callcenter-dashboard";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { Field } from "@/components/kit/field";

// Handoff §1: the main difference from the legacy screen. Default UCM Bayamón — it matches the
// legacy's own count exactly (132); "Todas" is today's prior combined behaviour (198, UCM + 3CX).
export function CallcenterPbxSelector({ value, onChange }: { value: CallcenterPbx; onChange: (v: CallcenterPbx) => void }) {
  const t = useTranslations("callcenter");
  return (
    <Field label={t("pbxLabel")} className="w-auto">
      <SegmentedControl
        ariaLabel={t("pbxLabel")}
        value={value}
        onChange={onChange}
        options={[
          { value: "ucm-bayamon", label: t("pbxUcm") },
          { value: "3cx", label: t("pbx3cx") },
          { value: "all", label: t("pbxAll") },
        ]}
        className="w-auto"
      />
    </Field>
  );
}
