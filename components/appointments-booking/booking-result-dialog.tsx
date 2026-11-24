"use client";

import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CheckmarkCircle02Icon, Stethoscope02Icon } from "@hugeicons/core-free-icons";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormFooter } from "@/components/kit/form-footer";
import { parseDayUTC } from "@/lib/format/fecha";
import type { BookingResult, BookingResultItem } from "@/lib/agenda/booking/booking-result";
import { shortTime } from "./booking-toolbar";

type Format = ReturnType<typeof useFormatter>;

function formatDay(format: Format, iso: string): string {
  const d = parseDayUTC(iso);
  return d ? format.dateTime(d, "dayWeekdayShort") : iso;
}

/** "Antes: mar, 24 nov · 9:00" (or the date alone when the old appointment had no time). */
function movedFromText(t: ReturnType<typeof useTranslations>, format: Format, from: NonNullable<BookingResultItem["from"]>) {
  return from.time
    ? t("movedFrom", { date: formatDay(format, from.date), time: shortTime(from.time) })
    : t("movedFromDate", { date: formatDay(format, from.date) });
}

/** A calendar leaf: weekday, day number, month. */
function DateTile({ iso }: { iso: string }) {
  const format = useFormatter();
  const d = parseDayUTC(iso);
  if (!d) return null;
  return (
    <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary/10 py-1.5 text-primary">
      <span className="text-[10px] font-semibold tracking-wider uppercase">{format.dateTime(d, "dayWeekdayOnly")}</span>
      <span className="text-xl leading-tight font-semibold tabular-nums">{d.getUTCDate()}</span>
      <span className="text-[10px] font-medium tracking-wider uppercase">{format.dateTime(d, "monthShort")}</span>
    </div>
  );
}

function ItemCard({ item }: { item: BookingResultItem }) {
  const t = useTranslations("appointmentsBooking.result");
  const format = useFormatter();
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <DateTile iso={item.date} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold tabular-nums">{shortTime(item.time)}</span>
          <span className="truncate text-sm">{item.typeName}</span>
        </div>
        {item.kind === "medical" && item.doctor && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Stethoscope02Icon} className="size-3.5" />
            <span className="truncate">{item.doctor}</span>
          </div>
        )}
        {item.from && (
          <div className="text-xs text-muted-foreground tabular-nums line-through">{movedFromText(t, format, item.from)}</div>
        )}
      </div>
    </li>
  );
}

/** The patient-facing printout: plain table, black on white (see `.appointments-print` in globals.css). */
function PrintSheet({ result }: { result: BookingResult }) {
  const t = useTranslations("appointmentsBooking.result");
  const format = useFormatter();
  const { patient, center } = result;
  return (
    <div className="appointments-print hidden space-y-4 print:block">
      <div>
        <div className="text-lg font-semibold">{center.name}</div>
        {center.address && <div className="text-sm">{center.address}</div>}
        {center.phone && <div className="text-sm">{center.phone}</div>}
      </div>
      <div>
        <h2 className="text-base font-semibold">{t("printHeading")}</h2>
        <p className="text-sm">
          {patient.name}
          {patient.record && ` · ${t("record", { n: patient.record })}`}
        </p>
      </div>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1.5 pr-4 font-semibold">{t("colDate")}</th>
            <th className="py-1.5 pr-4 font-semibold">{t("colTime")}</th>
            <th className="py-1.5 pr-4 font-semibold">{t("colService")}</th>
            <th className="py-1.5 font-semibold">{t("colDoctor")}</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((i) => (
            <tr key={`${i.date}|${i.time}|${i.typeName}`} className="border-b align-top">
              <td className="py-1.5 pr-4 tabular-nums">
                {formatDay(format, i.date)}
                {i.from && <div className="text-xs">{movedFromText(t, format, i.from)}</div>}
              </td>
              <td className="py-1.5 pr-4 tabular-nums">{shortTime(i.time)}</td>
              <td className="py-1.5 pr-4">{i.typeName}</td>
              <td className="py-1.5">{i.kind === "medical" ? (i.doctor ?? "") : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {center.phone && <p className="text-sm">{t("printCallUs", { phone: center.phone })}</p>}
    </div>
  );
}

/**
 * What a booking or a move produced: a confirmation header, one card per appointment (date tile, time,
 * service, doctor; a moved one shows the old date struck through), what was skipped and why, and the
 * BE's warnings. «Imprimir» prints the patient-facing sheet; «Cerrar» closes.
 */
export function BookingResultDialog({ result, onClose }: { result: BookingResult; onClose: () => void }) {
  const t = useTranslations("appointmentsBooking.result");
  const format = useFormatter();
  const { patient, center } = result;
  const n = result.items.length;
  const title = result.mode === "moved" ? t("movedTitle") : t("bookedCount", { n });
  const notes = [
    ...result.skipped.map((s) => ({ key: `s|${s.date}|${s.reason}`, text: `${formatDay(format, s.date)}: ${s.reason}` })),
    ...result.warnings.map((w) => ({ key: `w|${w}`, text: w })),
  ];

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-lg">
        <div className="flex items-start gap-3 pr-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success-foreground">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-6" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <DialogDescription className="truncate">
              <span className="font-medium text-foreground">{patient.name}</span>
              {patient.record && <> · {t("record", { n: patient.record })}</>}
              {center.name && <> · {center.name}</>}
            </DialogDescription>
          </div>
        </div>

        <div className="-mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
          <ul className="divide-y rounded-xl border bg-card">
            {result.items.map((i) => (
              <ItemCard key={`${i.date}|${i.time}|${i.typeName}`} item={i} />
            ))}
          </ul>

          {notes.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <div className="min-w-0 space-y-1">
                {result.skipped.length > 0 && <p className="font-medium">{t("skippedTitle")}</p>}
                <ul className="space-y-0.5 text-muted-foreground">
                  {notes.map((x) => (
                    <li key={x.key} className="tabular-nums">
                      {x.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <FormFooter
          primary={{ label: t("print"), onClick: () => window.print() }}
          onCancel={onClose}
          cancelLabel={t("close")}
        />

        <PrintSheet result={result} />
      </DialogContent>
    </Dialog>
  );
}
