"use client";

import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { PageContainer } from "@/components/ui/page";
import { UnlinkedMeasurements } from "@/components/body-measurements/unlinked-measurements";

// «Medidas sin vincular» (BE #509). Gate body_measurements.read; the BE scopes the rows to the
// centers where the caller holds it.
export default function UnlinkedMeasurementsPage() {
  const t = useTranslations("bodyMeasurements");
  const { can, ready } = useCan();
  if (ready && !can("body_measurements.read")) {
    return <PageContainer className="text-center text-sm text-muted-foreground">{t("noPermission")}</PageContainer>;
  }
  return <UnlinkedMeasurements />;
}
