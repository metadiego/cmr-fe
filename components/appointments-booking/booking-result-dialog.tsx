"use client";

import { useFormatter, useTranslations } from "next-intl";

import { FormDialog } from "@/components/kit/form-dialog";
import { RecordTable, Td, Th } from "@/components/kit/panel";
import { parseDayUTC } from "@/lib/format/fecha";
import type { BookingResult } from "@/lib/agenda/booking/booking-result";
import { shortTime } from "./booking-toolbar";

/** Items table, shared by the dialog and the printout. */
function ItemsTable({ result }: { result: BookingResult }) {
  const t = useTranslations("appointmentsBooking.result");
  const format = useFormatter();
  const day = (iso: string) => {
    const d = parseDayUTC(iso);
    return d ? format.dateTime(d, "dayWeekdayShort") : iso;
  };
  return (
    <RecordTable
      head={
        <tr>
          <Th>{t("colDate")}</Th>
          <Th>{t("colTime")}</Th>
          <Th>{t("colService")}</Th>
          <Th>{t("colDoctor")}</Th>
        </tr>
      }
    >
      {result.items.map((i) => (
        <tr key={`${i.date}|${i.time}|${i.typeName}`} className="border-t">
          <Td className="tabular-nums">
            {day(i.date)}
            {i.from && (
              <div className="text-muted-foreground text-xs">
                {t("movedFrom", { date: day(i.from.date), time: shortTime(i.from.time) })}
              </div>
            )}
          </Td>
          <Td className="tabular-nums">{shortTime(i.time)}</Td>
          <Td>{i.typeName}</Td>
          <Td>{i.kind === "medical" ? (i.doctor ?? "") : ""}</Td>
        </tr>
      ))}
    </RecordTable>
  );
}

export function BookingResultDialog({ result, onClose }: { result: BookingResult; onClose: () => void }) {
  const t = useTranslations("appointmentsBooking.result");
  const format = useFormatter();
  const day = (iso: string) => {
    const d = parseDayUTC(iso);
    return d ? format.dateTime(d, "dayWeekdayShort") : iso;
  };
  const { patient, center } = result;

  return (
    <FormDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      size="lg"
      title={result.mode === "moved" ? t("movedTitle") : t("bookedTitle")}
      onSubmit={onClose}
      cancelLabel={t("close")}
      actions={[{ label: t("print"), variant: "outline", onClick: () => window.print() }]}
    >
      <p className="text-sm">
        <span className="font-medium">{patient.name}</span>
        {patient.record && <span className="text-muted-foreground"> · {t("record", { n: patient.record })}</span>}
      </p>
      <ItemsTable result={result} />
      {result.skipped.length > 0 && (
        <section>
          <h3 className="text-sm font-medium">{t("skippedTitle")}</h3>
          <ul className="text-muted-foreground mt-1 list-disc pl-5 text-sm">
            {result.skipped.map((s) => (
              <li key={s.date}>
                <span className="tabular-nums">{day(s.date)}</span>: {s.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.warnings.length > 0 && (
        <section>
          <h3 className="text-sm font-medium">{t("warningsTitle")}</h3>
          <ul className="text-muted-foreground mt-1 list-disc pl-5 text-sm">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="appointments-print hidden space-y-3 print:block">
        <div>
          <div className="text-lg font-semibold">{center.name}</div>
          {center.address && <div className="text-sm">{center.address}</div>}
          {center.phone && <div className="text-sm">{center.phone}</div>}
        </div>
        <h2 className="text-base font-semibold">{t("printHeading")}</h2>
        <p className="text-sm">
          {patient.name}
          {patient.record && ` · ${t("record", { n: patient.record })}`}
        </p>
        <ItemsTable result={result} />
        {center.phone && <p className="text-sm">{t("printCallUs", { phone: center.phone })}</p>}
      </div>
    </FormDialog>
  );
}
