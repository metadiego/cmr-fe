"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { useTherapyQueue } from "@/hooks/use-therapy-queue"
import type { FrontdeskQueue } from "@/lib/api/frontdesk-queue"
import { queueEntryDisplayName, queueEntryRecord } from "@/lib/frontdesk/therapy-queue"
import { fmtHora } from "@/components/frontdesk/frontdesk-board.helpers"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface Props {
  centerId: string | undefined
  date: string
}

function serviceName(queue: FrontdeskQueue, serviceId: string): string {
  return queue.services.find((s) => s.serviceId === serviceId)?.name ?? serviceId
}

// Franja de pastillas por terapia ("N en sala · M en terapia") del tablero cola-por-terapia (BE
// PR #420/#421): cada una abre un panel lateral con quién espera (orden real de llegada), quién
// está en terapia, y quién está libre para tomarla ahora. Oculta en la vista "Consulta" (acuerdo
// con BE 10-oct-2026, §2.1.3 del spec): esa vista no tiene terapias que colear. Verificado en
// navegador real contra Bayamón (10-oct-2026, commit dd31008).
export function TherapyQueueStrip({ centerId, date }: Props) {
  const t = useTranslations("patientDesk.queue")
  const { queue } = useTherapyQueue(centerId, date)
  const [openServiceId, setOpenServiceId] = React.useState<string | null>(null)

  if (!queue) return null
  const visible = queue.services.filter((s) => s.waiting.length + s.inTherapy.length > 0)
  if (visible.length === 0) return null
  const active = queue.services.find((s) => s.serviceId === openServiceId) ?? null

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((svc) => (
          <button
            key={svc.serviceId}
            type="button"
            onClick={() => setOpenServiceId(svc.serviceId)}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:bg-muted/60"
            style={{ borderColor: svc.color ?? undefined }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: svc.color ?? "var(--muted-foreground)" }}
            />
            <span className="max-w-[120px] truncate">{svc.name}</span>
            <span className="text-muted-foreground">
              {t("pillLabel", { waiting: svc.waiting.length, inTherapy: svc.inTherapy.length })}
            </span>
          </button>
        ))}
      </div>
      <Sheet open={!!active} onOpenChange={(o) => !o && setOpenServiceId(null)}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle>{t("panelTitle", { service: active.name })}</SheetTitle>
                <SheetDescription>{t("panelDescription")}</SheetDescription>
              </SheetHeader>
              {active.waiting.length + active.inTherapy.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              ) : null}
              {active.inTherapy.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    {t("sectionInTherapy")}
                  </h3>
                  <ul className="space-y-1.5">
                    {active.inTherapy.map((e) => (
                      <li
                        key={e.sessionId}
                        className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{queueEntryDisplayName(e)}</div>
                          <div className="text-xs text-muted-foreground">
                            {queueEntryRecord(e) ? `#${queueEntryRecord(e)} · ` : ""}
                            {e.technicianName ?? "—"}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {t("minutesSince", { n: e.minutes })}
                          </span>
                          {e.estimatedEnd ? (
                            <span
                              className="text-[11px] text-muted-foreground"
                              title={
                                e.estimateSource === "history"
                                  ? t("estimatedEndHistoryTooltip")
                                  : undefined
                              }
                            >
                              {t("estimatedEnd", { time: fmtHora(e.estimatedEnd) })}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {active.waiting.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    {t("sectionWaiting")}
                  </h3>
                  <ul className="space-y-1.5">
                    {active.waiting.map((e) => (
                      <li
                        key={e.sessionId}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm ring-1 ring-foreground/10"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{queueEntryDisplayName(e)}</div>
                          <div className="text-xs text-muted-foreground">
                            {queueEntryRecord(e) ? `#${queueEntryRecord(e)} · ` : ""}
                            {t("turn", { turn: e.turn })}
                            {e.busyIn ? ` · ${t("busyIn", { service: serviceName(queue, e.busyIn) })}` : ""}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {fmtHora(e.arrivedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="border-t pt-3 text-xs text-muted-foreground">
                {!active.skillsConfigured
                  ? t("skillsNotConfigured")
                  : active.free.length > 0
                    ? t("free", { names: active.free.map((f) => f.name).join(", ") })
                    : t("noneFree")}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
