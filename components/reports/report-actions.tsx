"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download04Icon, PrinterIcon } from "@hugeicons/core-free-icons"

import { toCsv } from "@/lib/caja/export"
import { buildReportHtml, reportFileName } from "@/lib/reports/print-document"
import { useMe } from "@/hooks/use-me"
import { Button } from "@/components/ui/button"

// The house logo, same asset the cash and statistics reports print.
const REPORT_LOGO = "/img/logo_cmr.png"

// The report bar: Imprimir · CSV (and Email once the BE ships POST /reports/email, handoff
// docs/specs/kardex-resumen-formato-dueno-handoff-be.md). One pattern for every report: the print goes to
// its own window with the same letterhead and footer (in place it printed blank: the shell isolates the
// thermal receipt), the CSV opens in Excel. `target` is the element whose visible content is the report.
export function ReportActions({
  target,
  title,
  subtitle,
  csv,
  fileParts,
  disabled,
}: {
  target: React.RefObject<HTMLElement | null>
  title: string
  subtitle?: string
  /** Rows of the CSV (header first); omit to hide the button. */
  csv?: () => ReadonlyArray<ReadonlyArray<string | number>>
  /** Pieces of the file name, e.g. [title, product, from, to]. */
  fileParts: string[]
  disabled?: boolean
}) {
  const t = useTranslations("reports")
  const format = useFormatter()
  const me = useMe()
  const who = me.kind === "ok" ? (me.me.email ?? "") : ""

  function print() {
    const el = target.current
    if (!el) return
    const w = window.open("", "_blank", "width=1000,height=1200")
    if (!w) return // popup blocked
    const footer = t("printedBy", {
      who: who || "—",
      when: format.dateTime(new Date(), "dateAndTime"),
    })
    w.document.write(
      buildReportHtml({
        title,
        subtitle,
        bodyHtml: el.innerHTML,
        footer,
        logoUrl: `${window.location.origin}${REPORT_LOGO}`,
      })
    )
    w.document.close()
    w.focus()
    // Wait for the logo (and any image) so it is on the page, not a blank box.
    const go = () => w.print()
    const imgs = Array.from(w.document.images ?? [])
    if (imgs.every((i) => i.complete)) go()
    else
      Promise.all(
        imgs.map((i) =>
          i.complete
            ? null
            : new Promise((r) => {
                i.onload = i.onerror = r
              })
        )
      ).then(go)
  }

  function downloadCsv() {
    if (!csv) return
    // BOM so Excel reads the accents as UTF-8.
    const blob = new Blob(["\uFEFF" + toCsv(csv())], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportFileName(...fileParts)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="no-print flex gap-2">
      {csv && (
        <Button
          variant="outline"
          size="sm"
          onClick={downloadCsv}
          disabled={disabled}
        >
          <HugeiconsIcon icon={Download04Icon} className="size-4" /> {t("csv")}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={print} disabled={disabled}>
        <HugeiconsIcon icon={PrinterIcon} className="size-4" /> {t("print")}
      </Button>
    </div>
  )
}
