"use client";

import { useFormatter } from "next-intl";

import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

/** A calendar leaf: weekday, day number, month (the booking success and move dialogs). `muted` for a
 *  date that is being left behind (a move's current slot). */
export function DateTile({ iso, muted = false }: { iso: string; muted?: boolean }) {
  const format = useFormatter();
  const d = parseDayUTC(iso);
  if (!d) return null;
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5",
        muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
      )}
    >
      <span className="text-[10px] font-semibold tracking-wider uppercase">{format.dateTime(d, "dayWeekdayOnly")}</span>
      <span className="text-xl leading-tight font-semibold tabular-nums">{d.getUTCDate()}</span>
      <span className="text-[10px] font-medium tracking-wider uppercase">{format.dateTime(d, "monthShort")}</span>
    </div>
  );
}
