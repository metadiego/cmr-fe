"use client";

import { useTranslations } from "next-intl";

import { addDaysToDay, RETURN_SHORTCUTS } from "@/lib/agenda/next-appointment";
import { todayPR } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";

// "When is the patient back?": 1 week / 2 weeks / 1 month / 3 months chips, counted from today, plus the
// calendar for any other day. Shared by the post-visit modal (Nueva cita) and the "Next appt" cell, so
// both offer the same shortcuts.
export function ReturnDatePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (day: string) => void;
  className?: string;
}) {
  const t = useTranslations("nuevaCita");
  const today = todayPR();
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {RETURN_SHORTCUTS.map((q) => {
        const day = addDaysToDay(today, q.days);
        const active = value === day;
        return (
          <button
            key={q.key}
            type="button"
            onClick={() => onChange(day)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {t(q.key)}
          </button>
        );
      })}
      <DatePicker value={value} onChange={onChange} className="w-[9.5rem]" min={today} />
    </div>
  );
}
