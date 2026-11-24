"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// The booking calendar's top rows: "Booking" / "Book for Ana" + the type chip (✕ to change it), the
// Free/Booked switch (medical types only). The "Next free" strip was removed (owner, 2026-11-23). Every hour of the day is always
// shown: the Mañana/Tarde filter was removed (owner, 2026-11-23).

export type BookingView = "free" | "booked";

/** "08:00" → "8:00" (24-hour digits carry no language). */
export function shortTime(time: string): string {
  return time.replace(/^0(\d)/, "$1");
}

export function BookingToolbar({
  label,
  typeName,
  color,
  onClearType,
  view,
  onView,
}: {
  label: string;
  typeName: string;
  color: string | null;
  onClearType: () => void;
  /** Omit (with onView) to hide the Free/Booked switch: services only offer Free. */
  view?: BookingView;
  onView?: (v: BookingView) => void;
}) {
  const t = useTranslations("appointmentsBooking.toolbar");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-2.5 text-sm">
          <span
            className="size-2.5 rounded-full bg-muted-foreground/40"
            style={color ? { backgroundColor: color } : undefined}
            aria-hidden
          />
          {typeName}
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onClearType}
            aria-label={t("changeType")}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
          </Button>
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {view && onView && (
            <Tabs value={view} onValueChange={(v) => onView(v as BookingView)}>
              <TabsList aria-label={t("viewLabel")}>
                <TabsTrigger value="free">{t("free")}</TabsTrigger>
                <TabsTrigger value="booked">{t("booked")}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

    </div>
  );
}
