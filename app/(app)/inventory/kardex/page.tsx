"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"

import {
  getDailyKardex,
  getKardexDay,
  getKardexSummary,
  type KardexDaily,
  type KardexDayMovement,
  type KardexSummary,
} from "@/lib/api/inventory-kardex"
import {
  defaultKardexRange,
  groupKardexDayMovements,
  readableDocument,
  sessionLabel,
  validRange,
} from "@/lib/inventory/kardex"
import { formatFechaSolo, todayPR } from "@/lib/format/fecha"
import { useResource } from "@/hooks/use-resource"
import { useCentroGate } from "@/hooks/use-centro-gate"
import { ProductoPicker } from "@/components/inventario/producto-picker"
import { Button } from "@/components/ui/button"
import { ReportActions } from "@/components/reports/report-actions"
import { KardexOwnerSummary } from "@/components/inventario/kardex-owner-summary"
import { dailyCsv, movementsCsv, ownerCsv } from "@/lib/inventory/kardex-csv"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { PageContainer, PageHeader } from "@/components/ui/page"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// DAILY KARDEX of one product in one center, in sealed units (vials): a row per day, that day's detail
// («Ver día») and the management summary of the period. One pattern for every product; the BE decides
// which reason lands in which column (cmr-be docs/specs/kardex-diario-de-inventario.md, handoff
// docs/specs/kardex-diario-handoff.md). Print = the browser's (PDF included); the filters are no-print.

type KardexTab = "daily" | "owner" | "summary"

export default function DailyKardexPage() {
  const t = useTranslations("inventoryKardex")
  const format = useFormatter()
  const gate = useCentroGate()

  const [centerRaw, setCenterRaw] = React.useState("")
  const centerId = centerRaw || gate.centro || gate.centros[0]?.id || ""
  const centerName = gate.centros.find((c) => c.id === centerId)?.name ?? ""

  const initial = React.useMemo(() => defaultKardexRange(todayPR()), [])
  const [productId, setProductId] = React.useState("")
  const [from, setFrom] = React.useState(initial.from)
  const [to, setTo] = React.useState(initial.to)
  const [day, setDay] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<KardexTab>("daily")
  // «Por día» prints alone unless asked: then the management summary follows, on the same sheet when it
  // fits and on the next one when it does not (print-keep in lib/reports/print-document.ts).
  const [printOwner, setPrintOwner] = React.useState(false)
  const printRef = React.useRef<HTMLDivElement>(null)

  const ready = !!(centerId && productId && validRange(from, to))
  const dailyRes = useResource<KardexDaily | null>(
    () =>
      ready
        ? getDailyKardex({ productId, from, to }, centerId)
        : Promise.resolve(null),
    [productId, from, to, centerId]
  )
  const summaryRes = useResource<KardexSummary | null>(
    () =>
      ready
        ? getKardexSummary({ productId, from, to }, centerId)
        : Promise.resolve(null),
    [productId, from, to, centerId]
  )
  const dayRes = useResource<KardexDayMovement[] | null>(
    () =>
      day && productId && centerId
        ? getKardexDay({ productId, date: day }, centerId)
        : Promise.resolve(null),
    [day, productId, centerId]
  )

  const daily = dailyRes.state.kind === "ok" ? dailyRes.state.data : null
  const summary = summaryRes.state.kind === "ok" ? summaryRes.state.data : null
  const movements = dayRes.state.kind === "ok" ? dayRes.state.data : null
  const withProportion = daily?.product.capacity != null
  // One row per delivery, not per raw ledger line (owner, 18-nov-2026: opening a vial and applying
  // its content are two separate stock movements, but staff reading this screen see one clinical
  // event — repeating the same patient 2-4 times over was "a complete disaster" to read).
  const dayGroups = React.useMemo(
    () => (movements ? groupKardexDayMovements(movements) : []),
    [movements]
  )

  const num = (v: number | null | undefined, decimals = 0) =>
    v == null
      ? "—"
      : format.number(v, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: 2,
        })
  // MM/DD/YYYY always (business standard, independent of the language picker — same reasoning as
  // the 24h clock / USD money in i18n/formats.ts: a numeral order, not a translation).
  const dayText = (d: string) => formatFechaSolo(d) || d
  // reason = movement_reasons.slug; a new reason is a DB row, so an unknown slug shows as-is.
  const reasonText = (r: string | null | undefined) =>
    !r ? "—" : t.has(`reason.${r}`) ? t(`reason.${r}`) : r
  const totals = daily?.days.reduce(
    (a, d) => ({
      inbound: a.inbound + d.inbound,
      applied: a.applied + d.applied,
      adjustments: a.adjustments + d.adjustments,
    }),
    { inbound: 0, applied: 0, adjustments: 0 }
  )

  return (
    <PageContainer className="w-full">
      <PageHeader
        title={t("title")}
        description={
          daily
            ? `${daily.product.name}${daily.product.sku ? ` · ${daily.product.sku}` : ""} · ${centerName} · ${dayText(from)} – ${dayText(to)}`
            : t("subtitle")
        }
        actions={
          daily && (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {tab === "daily" && summary?.ownerFormat && (
                <Label
                  htmlFor="kardex-print-owner"
                  title={t("printOwnerHint")}
                  className="cursor-pointer text-sm font-normal"
                >
                  <Checkbox
                    id="kardex-print-owner"
                    checked={printOwner}
                    onCheckedChange={(v) => setPrintOwner(v === true)}
                  />
                  {t("printOwner")}
                </Label>
              )}
              <ReportActions
                target={printRef}
                title={`${t("title")} · ${daily.product.name}`}
                subtitle={`${centerName} · ${dayText(from)} – ${dayText(to)}`}
                csv={() =>
                  tab === "summary"
                    ? movementsCsv(summary, t, reasonText)
                    : tab === "owner"
                      ? ownerCsv(summary, t, reasonText)
                      : dailyCsv(daily, t)
                }
                fileParts={[
                  t("title"),
                  daily.product.sku || daily.product.name,
                  from,
                  to,
                ]}
              />
            </div>
          )
        }
      />

      <div className="no-print flex flex-wrap items-end gap-3">
        {gate.puedeCambiar && gate.centros.length > 1 && (
          <div className="flex flex-col gap-1">
            <Label>{t("center")}</Label>
            <Select
              value={centerId}
              onValueChange={(v) => {
                setCenterRaw(v)
                setDay(null)
              }}
            >
              <SelectTrigger className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gate.centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex min-w-72 flex-col gap-1">
          <Label>{t("product")}</Label>
          <ProductoPicker
            value={productId}
            onChange={(id) => {
              setProductId(id)
              setDay(null)
            }}
            placeholder={t("pickProduct")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="kardex-from">{t("from")}</Label>
          <DatePicker id="kardex-from" value={from} onChange={setFrom} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="kardex-to">{t("to")}</Label>
          <DatePicker id="kardex-to" value={to} onChange={setTo} />
        </div>
      </div>

      {!productId && (
        <p className="text-sm text-muted-foreground">{t("pickProduct")}</p>
      )}
      {productId && !validRange(from, to) && (
        <p className="text-sm text-destructive">{t("badRange")}</p>
      )}
      {dailyRes.state.kind === "loading" && productId && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {dailyRes.state.kind === "fail" && (
        <p className="text-sm text-destructive">{dailyRes.state.message}</p>
      )}

      {daily && (
        <div ref={printRef}>
          <Tabs value={tab} onValueChange={(v) => setTab(v as KardexTab)}>
            <TabsList className="no-print">
              <TabsTrigger value="daily">{t("tabDaily")}</TabsTrigger>
              {summary?.ownerFormat && (
                <TabsTrigger value="owner">{t("tabOwner")}</TabsTrigger>
              )}
              <TabsTrigger value="summary">{t("tabSummary")}</TabsTrigger>
            </TabsList>

            <TabsContent value="daily">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("col.date")}</TableHead>
                      <TableHead className="text-right">
                        {t("col.opening")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("col.inbound")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("col.applied")}
                      </TableHead>
                      {withProportion && (
                        <TableHead className="text-right">
                          {t("col.proportion")}
                        </TableHead>
                      )}
                      <TableHead className="text-right">
                        {t("col.adjustments")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("col.closing")}
                      </TableHead>
                      <TableHead className="no-print text-right">
                        {t("col.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daily.days.map((d) => {
                      // Dimmed, not disabled: adjustments can net to zero (+133 / −133 on 1-nov) and still be there.
                      const quiet = !d.inbound && !d.applied && !d.adjustments
                      return (
                        <TableRow
                          key={d.date}
                          className={
                            quiet ? "text-muted-foreground" : undefined
                          }
                        >
                          <TableCell className="tabular-nums">
                            {dayText(d.date)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {num(d.opening)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.inbound ? num(d.inbound) : ""}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.applied ? num(d.applied) : ""}
                          </TableCell>
                          {withProportion && (
                            <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                              {d.appliedProportion
                                ? num(d.appliedProportion, 2)
                                : ""}
                            </TableCell>
                          )}
                          <TableCell className="text-right tabular-nums">
                            {d.adjustments ? num(d.adjustments) : ""}
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground tabular-nums">
                            {num(d.closing)}
                          </TableCell>
                          <TableCell className="no-print py-1 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDay(d.date)}
                            >
                              {t("viewDay")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  {totals && (
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-semibold">
                          {t("periodTotal")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {num(daily.days[0]?.opening)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {num(totals.inbound)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {num(totals.applied)}
                        </TableCell>
                        {withProportion && (
                          <TableCell className="text-right text-xs tabular-nums">
                            {num(summary?.appliedProportion, 2)}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-semibold tabular-nums">
                          {num(totals.adjustments)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {num(daily.days.at(-1)?.closing)}
                        </TableCell>
                        <TableCell className="no-print" />
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </TabsContent>

            {summary?.ownerFormat && (
              <TabsContent value="owner">
                <KardexOwnerSummary
                  data={summary.ownerFormat}
                  from={summary.from}
                  to={summary.to}
                />
              </TabsContent>
            )}

            <TabsContent value="summary">
              {summaryRes.state.kind === "fail" && (
                <p className="text-sm text-destructive">
                  {summaryRes.state.message}
                </p>
              )}
              {summary && (
                <div className="max-w-4xl rounded-lg border">
                  <Table>
                    <TableBody>
                      <TableRow className="bg-muted/40">
                        <TableCell className="font-semibold">
                          {t("summary.opening", {
                            date: dayText(summary.from),
                          })}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {num(summary.opening)}
                        </TableCell>
                      </TableRow>
                      {summary.lines.map((l, i) => {
                        const doc =
                          l.documentNumber ?? readableDocument(l.documentId)
                        return (
                          <TableRow key={`${l.date}-${i}`}>
                            <TableCell>
                              <div>
                                <span className="font-medium">
                                  {l.kind === "inbound"
                                    ? t("summary.inbound")
                                    : t("summary.adjustment")}
                                </span>
                                {" · "}
                                {dayText(l.date)}
                                {doc && (
                                  <span className="ml-1 font-mono text-xs">
                                    #{doc}
                                  </span>
                                )}
                                {l.reason && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · {reasonText(l.reason)}
                                  </span>
                                )}
                              </div>
                              {l.notes && (
                                <div className="text-xs text-muted-foreground">
                                  {l.notes}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {l.quantity > 0 ? "+" : ""}
                              {num(l.quantity)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      <TableRow>
                        <TableCell>
                          {t("summary.applied", { date: dayText(summary.to) })}
                          {summary.appliedProportion != null && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({t("col.proportion")}:{" "}
                              {num(summary.appliedProportion, 2)})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          −{num(summary.applied)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/40">
                        <TableCell className="font-semibold">
                          {t("summary.closing", { date: dayText(summary.to) })}
                        </TableCell>
                        <TableCell className="text-right text-base font-bold tabular-nums">
                          {num(summary.closing)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
          {printOwner && tab === "daily" && summary?.ownerFormat && (
            <div className="print-only print-keep hidden">
              <h2 className="print-section">{t("tabOwner")}</h2>
              <KardexOwnerSummary
                data={summary.ownerFormat}
                from={summary.from}
                to={summary.to}
              />
            </div>
          )}
        </div>
      )}

      <Dialog open={!!day} onOpenChange={(o) => !o && setDay(null)}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {t("dayTitle", { date: day ? dayText(day) : "" })}
              {daily ? ` · ${daily.product.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {dayRes.state.kind === "loading" && (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          )}
          {dayRes.state.kind === "fail" && (
            <p className="text-sm text-destructive">{dayRes.state.message}</p>
          )}
          {movements && movements.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noMovements")}</p>
          )}
          {movements && movements.length > 0 && (
            <div className="max-h-[70vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("day.patient")}</TableHead>
                    <TableHead>{t("day.record")}</TableHead>
                    <TableHead>{t("day.session")}</TableHead>
                    <TableHead className="text-right">
                      {t("day.vials")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("day.contentAmount")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayGroups.map((g) => (
                    <TableRow key={g.key}>
                      <TableCell>
                        {g.patientName || "—"}
                        {g.retroactiveRecordedAt && (
                          <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning-foreground">
                            {t("day.retroactive", {
                              when: format.dateTime(
                                new Date(g.retroactiveRecordedAt),
                                "dateAndTime"
                              ),
                            })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {g.medicalRecordNumber ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {sessionLabel(g.sessionNumber, g.sessionsTotal) ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.vials === 0 ? "—" : num(g.vials, 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.content === 0 ? "—" : num(g.content, 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
