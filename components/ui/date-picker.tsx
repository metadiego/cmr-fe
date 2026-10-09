"use client"

import * as React from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { enUS, es } from "react-day-picker/locale"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { parseDayUTC, todayPR } from "@/lib/format/fecha"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Drop-in replacement for `<Input type="date">`: same "YYYY-MM-DD" string in and out, so call
// sites keep their state as-is. The value is a calendar DAY, not an instant — it is converted to a
// LOCAL Date only for the calendar grid and straight back from local parts, never through UTC,
// which is what keeps "pick the 4th, store the 4th" true in every timezone.

const DAY_LOCALES = { es, en: enUS } as const

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/

function toLocalDate(v: string | undefined): Date | undefined {
  const m = v?.match(DATE_ONLY)
  if (!m) return undefined
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function toDayString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  disabled?: boolean
  /** Shows the value without letting it change (the old `readOnly` date inputs). */
  readOnly?: boolean
  /** Adds a "Clear" action, for optional dates and filters. */
  clearable?: boolean
  placeholder?: string
  id?: string
  className?: string
  title?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
}

function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  readOnly,
  clearable,
  placeholder,
  id,
  className,
  title,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const t = useTranslations("picker")
  const format = useFormatter()
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)

  const selected = toLocalDate(value)
  const minDate = toLocalDate(min)
  const maxDate = toLocalDate(max)
  const shown = parseDayUTC(value)
  const today = todayPR()
  const todayAllowed = (!min || today >= min) && (!max || today <= max)

  // Year dropdown range: far enough back for birth dates, a decade ahead for expiry dates.
  const now = new Date()
  const startMonth = minDate ?? new Date(now.getFullYear() - 110, 0)
  const endMonth = maxDate ?? new Date(now.getFullYear() + 10, 11)

  function pick(next: string) {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          title={title}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-readonly={readOnly || undefined}
          data-empty={!shown}
          className={cn(
            "h-9 w-full justify-start px-3 text-left font-normal data-[empty=true]:text-muted-foreground",
            readOnly && "pointer-events-none bg-muted/40",
            className,
          )}
        >
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} data-icon="inline-start" />
          <span className="truncate">
            {shown ? format.dateTime(shown, "dayMonthYear") : (placeholder ?? t("pickDate"))}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 overflow-hidden rounded-lg p-0" align="start">
        <Calendar
          mode="single"
          locale={DAY_LOCALES[locale as keyof typeof DAY_LOCALES] ?? es}
          captionLayout="dropdown"
          selected={selected}
          defaultMonth={selected ?? toLocalDate(today)}
          startMonth={startMonth}
          endMonth={endMonth}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          onSelect={(d) => d && pick(toDayString(d))}
          autoFocus
        />
        <div className="flex items-center gap-2 border-t p-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={!todayAllowed}
            onClick={() => pick(today)}
          >
            {t("today")}
          </Button>
          {clearable && value ? (
            <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => pick("")}>
              {t("clear")}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
export type { DatePickerProps }
