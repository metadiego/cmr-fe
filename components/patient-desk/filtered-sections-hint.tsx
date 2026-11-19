"use client"

import { useTranslations } from "next-intl"

// «Mostrando solo: Vitamina C · ver todas (3)» above the patient's therapies when the board's service
// filter narrows them; one click shows them all without clearing the filter, another narrows again.
export function FilteredSectionsHint({
  serviceName,
  hidden,
  showAll,
  onToggle,
}: {
  serviceName: string
  hidden: number
  showAll: boolean
  onToggle: () => void
}) {
  const t = useTranslations("patientDesk.filteredSections")
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-md bg-primary/5 px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-primary/20">
      <span>{showAll ? t("showingAll") : t("showingOnly", { service: serviceName })}</span>
      <button type="button" onClick={onToggle} className="font-medium text-primary underline-offset-2 hover:underline">
        {showAll ? t("onlyFiltered", { service: serviceName }) : t("seeAll", { n: hidden })}
      </button>
    </p>
  )
}
