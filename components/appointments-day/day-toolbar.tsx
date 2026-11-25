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
import { TypeFilter } from "@/components/appointments-day/type-filter";
import { BOOKED_BY_ALL, BOOKED_BY_ME, type TypeOption } from "@/lib/appointments-day/day-list";
import { shiftDay } from "@/lib/agenda/appointment-form";

export interface StaffOption {
  id: string;
  name: string;
}

// The Citas screen's filters (docs/specs/citas-day-screen.md): the day (‹ date › Today),
// the appointment types / services picked, who created it ("Booked by"), whose
// portfolio the patient is in ("Cartera"), and whether cancelled rows show. Everything wraps at 375px.
export function DayToolbar({
  date,
  today,
  onDate,
  typeOptions,
  types,
  onTypes,
  bookedBy,
  onBookedBy,
  owner,
  onOwner,
  staff,
  canBeMe,
  includeCancelled,
  onIncludeCancelled,
  kpis,
}: {
  date: string;
  today: string;
  onDate: (d: string) => void;
  /** The picker's entries; null while they load. */
  typeOptions: TypeOption[] | null;
  types: string[];
  onTypes: (ids: string[]) => void;
  /** null while it cannot be told yet (the person or the staff list still loading). */
  bookedBy: string | null;
  onBookedBy: (v: string) => void;
  /** "Cartera" (the patient's portfolio owner); null while it cannot be told yet. */
  owner: string | null;
  onOwner: (v: string) => void;
  staff: StaffOption[];
  /** The person has a staff record, so "Me" means something. */
  canBeMe: boolean;
  includeCancelled: boolean;
  onIncludeCancelled: (v: boolean) => void;
  /** The numbers row: a full-width line between the date bar and the filters. */
  kpis?: React.ReactNode;
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

      {kpis && <div className="w-full">{kpis}</div>}

      <TypeFilter options={typeOptions} picked={types} onChange={onTypes} />

      <StaffSelect label={t("bookedBy.label")} value={bookedBy} onChange={onBookedBy} staff={staff} canBeMe={canBeMe} />
      <StaffSelect label={t("owner.label")} value={owner} onChange={onOwner} staff={staff} canBeMe={canBeMe} />

      <div className="flex items-center gap-2">
        <Switch id={cancelledId} checked={includeCancelled} onCheckedChange={onIncludeCancelled} />
        <Label htmlFor={cancelledId} className="text-sm font-normal">
          {t("showCancelled")}
        </Label>
      </div>
    </div>
  );
}

/** A "me / everyone / a staff member" select ("Booked by", "Cartera"). */
function StaffSelect({
  label,
  value,
  onChange,
  staff,
  canBeMe,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  staff: StaffOption[];
  canBeMe: boolean;
}) {
  const t = useTranslations("appointmentsDay");
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <Select value={value ?? ""} onValueChange={onChange} disabled={value === null}>
        <SelectTrigger size="sm" className="w-44" aria-label={label}>
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
  );
}
