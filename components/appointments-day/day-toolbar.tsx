"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { BOOKED_BY_ALL, BOOKED_BY_ME, TYPE_BUCKETS, type TypeBucket } from "@/lib/appointments-day/day-list";
import { shiftDay } from "@/lib/agenda/appointment-form";

export interface StaffOption {
  id: string;
  name: string;
}

// The Citas screen's filters (docs/specs/citas-day-screen.md): the day (‹ date › Today), the type bucket,
// who booked it, and whether cancelled rows show. Everything wraps at 375px.
export function DayToolbar({
  date,
  today,
  onDate,
  bucket,
  onBucket,
  bookedBy,
  onBookedBy,
  staff,
  canBeMe,
  includeCancelled,
  onIncludeCancelled,
}: {
  date: string;
  today: string;
  onDate: (d: string) => void;
  bucket: TypeBucket;
  onBucket: (b: TypeBucket) => void;
  bookedBy: string;
  onBookedBy: (v: string) => void;
  staff: StaffOption[];
  /** The person has a staff record, so "Me" means something. */
  canBeMe: boolean;
  includeCancelled: boolean;
  onIncludeCancelled: (v: boolean) => void;
}) {
  const t = useTranslations("appointmentsDay");
  const cancelledId = React.useId();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => onDate(shiftDay(date, -1))} aria-label={t("prevDay")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Button>
        <DatePicker value={date} onChange={(d) => d && onDate(d)} variant="button" displayFormat="dayWeekdayShort" />
        <Button variant="outline" size="icon-sm" onClick={() => onDate(shiftDay(date, 1))} aria-label={t("nextDay")}>
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDate(today)} disabled={date === today}>
          {t("today")}
        </Button>
      </div>

      <SegmentedControl
        ariaLabel={t("type.label")}
        value={bucket}
        onChange={onBucket}
        options={TYPE_BUCKETS.map((b) => ({ value: b, label: t(`type.${b}`) }))}
      />

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("bookedBy.label")}</span>
        <Select value={bookedBy} onValueChange={onBookedBy}>
          <SelectTrigger size="sm" className="w-44" aria-label={t("bookedBy.label")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {canBeMe && <SelectItem value={BOOKED_BY_ME}>{t("bookedBy.me")}</SelectItem>}
            <SelectItem value={BOOKED_BY_ALL}>{t("bookedBy.all")}</SelectItem>
            {staff.length > 0 && <SelectSeparator />}
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Switch id={cancelledId} checked={includeCancelled} onCheckedChange={onIncludeCancelled} />
        <Label htmlFor={cancelledId} className="text-sm font-normal">
          {t("showCancelled")}
        </Label>
      </div>
    </div>
  );
}
