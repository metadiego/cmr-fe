"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download04Icon, Mail01Icon, PrinterIcon } from "@hugeicons/core-free-icons"

import { toCsv } from "@/lib/caja/export"
import { buildReportHtml, reportFileName } from "@/lib/reports/print-document"
import { base64ToBytes } from "@/lib/frontdesk/day-summary"
import { toastError } from "@/lib/api/errors"
import type { ExportResult } from "@/lib/api/day-summary"
import { useMe } from "@/hooks/use-me"
import { Button } from "@/components/ui/button"
import { EmailReportDialog } from "@/components/reports/email-report-dialog"

// The house logo, same asset the cash and statistics reports print.
const REPORT_LOGO = "/img/logo_cmr.png"

// The report bar: Imprimir · CSV · Email. With `exporter` (a resource of the BE export engine, POST
// /export) the CSV comes from the BE and Email appears, both logged in /export/jobs; without it the CSV is
// built here from `csv` and there is no Email yet. One pattern for every report: the print goes to
// its own window with the same letterhead and footer (in place it printed blank: the shell isolates the
// thermal receipt), the CSV opens in Excel. `target` is the element whose visible content is the report.
export function ReportActions({
  target,
  title,
  subtitle,
  csv,
  fileParts,
  disabled,
  exporter,
}: {
  target: React.RefObject<HTMLElement | null>
  title: string
  subtitle?: string
  /** Rows of the CSV (header first); omit to hide the button. */
  csv?: () => ReadonlyArray<ReadonlyArray<string | number>>
  /** Pieces of the file name, e.g. [title, product, from, to]. */
  fileParts: string[]
  disabled?: boolean
  /** The BE export of this report: CSV download and PDF by email go through it (traceable). */
  exporter?: (format: "csv" | "pdf", channel: "download" | "email", destination?: string) => Promise<ExportResult>
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

  const [emailOpen, setEmailOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const tRoot = useTranslations()

  async function exportCsv() {
    if (!exporter) return
    setExporting(true)
    try {
      const r = await exporter("csv", "download")
      const url = URL.createObjectURL(new Blob([base64ToBytes(r.base64)], { type: r.mime || "text/csv" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `${reportFileName(...fileParts)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toastError(err, tRoot)
    } finally {
      setExporting(false)
    }
  }

  function downloadCsv() {
    if (exporter) return void exportCsv()
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
      {(csv || exporter) && (
        <Button
          variant="outline"
          size="sm"
          onClick={downloadCsv}
          disabled={disabled || exporting}
        >
          <HugeiconsIcon icon={Download04Icon} className="size-4" /> {t("csv")}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={print} disabled={disabled}>
        <HugeiconsIcon icon={PrinterIcon} className="size-4" /> {t("print")}
      </Button>
      {exporter && (
        <>
          <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)} disabled={disabled}>
            <HugeiconsIcon icon={Mail01Icon} className="size-4" /> {t("email")}
          </Button>
          {emailOpen && (
            <EmailReportDialog
              open={emailOpen}
              onOpenChange={setEmailOpen}
              title={subtitle ? `${title} · ${subtitle}` : title}
              send={(to) => exporter("pdf", "email", to)}
            />
          )}
        </>
      )}
    </div>
  )
}
