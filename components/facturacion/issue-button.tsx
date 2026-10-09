"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { emitirFactura, type FacturaConItems } from "@/lib/api/facturas";
import { ApiError } from "@/lib/api/types";
import { parseDayUTC } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";

interface Props {
  invoice: FacturaConItems;
  invoiceId: string;
  centro?: string;
  disabled: boolean;
  label: string;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}

// Local calendar day, YYYY-MM-DD: the latest date an invoice may be issued on (backwards only).
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// «Emitir». A REOPENED draft (it already has its number) can be re-issued on another day: the date
// field shows its own date, and only a changed date is sent. The BE checks it fits between the
// neighbouring numbers and, if not, answers with the range that does — shown as is.
export function IssueButton({ invoice, invoiceId, centro, disabled, label, run }: Props) {
  const t = useTranslations("invoiceReopen");
  const tRoot = useTranslations();
  const format = useFormatter();
  const reopened = invoice.number != null && invoice.number !== "";
  const ownDate = String(invoice.date ?? "").slice(0, 10);
  const [date, setDate] = React.useState(ownDate);

  const day = (v: unknown) => {
    const d = parseDayUTC(v);
    return d ? format.dateTime(d, "dayShort") : String(v ?? "—");
  };

  function issue() {
    return run(async () => {
      try {
        await emitirFactura(invoiceId, centro, reopened && date && date !== ownDate ? date : undefined);
      } catch (err) {
        if (err instanceof ApiError && err.code === "INVOICE_DATE_OUT_OF_SEQUENCE") {
          // `to: null` = last of its series (only a lower bound); `from: null` = first of it.
          const { from, to } = (err.data ?? {}) as { from?: string | null; to?: string | null };
          toast.error(
            from && to ? t("dateOutOfRange", { from: day(from), to: day(to) })
            : from ? t("dateOutOfRangeFrom", { from: day(from) })
            : to ? t("dateOutOfRangeTo", { to: day(to) })
            : tRoot("invoice.reopen.dateOutOfSequence"),
          );
          return;
        }
        throw err;
      }
    });
  }

  return (
    <div className="space-y-2">
      {reopened && (
        <div className="space-y-1">
          <Label htmlFor="issue-date" className="text-xs text-muted-foreground">{t("issueDate")}</Label>
          <DatePicker id="issue-date" value={date} max={today()} onChange={setDate} />
        </div>
      )}
      <Button className="w-full" disabled={disabled || (reopened && !date)} onClick={issue}>
        {label}
      </Button>
    </div>
  );
}
