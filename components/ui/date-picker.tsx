"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { enUS, es } from "react-day-picker/locale"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { formatFechaSolo, parseFechaEscrita, todayPR, validarFechaNacimiento, type FechaEscritaError, type FechaNacimientoError } from "@/lib/format/fecha"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Drop-in replacement for `<Input type="date">`: same "YYYY-MM-DD" string in and out, so call
// sites keep their state as-is. The value is a calendar DAY, not an instant — it is converted to a
// LOCAL Date only for the calendar grid and straight back from local parts, never through UTC,
// which is what keeps "pick the 4th, store the 4th" true in every timezone.
//
// Owner request (17-nov-2026): staff type dates fast (03/15/1958) and a click-only calendar was too
// slow for them — now the field is a plain text input (MM/DD/YYYY, with or without slashes, or the
// 8 bare digits) with the calendar as a secondary picker behind the icon button, never the only way
// in. Invalid input shows its OWN inline error right here and never calls `onChange` — the caller's
// `value` only ever moves to a date that actually parsed.
//
// "Not future" / "sane age" are NOT universal — a booking, an expiry, a return date is routinely
// future (real regression caught same day: applying them to every DatePicker broke "book a next
// appointment"). Pass `birthDate` to opt into those two extra checks; every other caller only gets
// the universal one (a real calendar date).

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
  /** Opts into the two birth-date-only rules on typed input: never future, age 0-120. Every other
   * DatePicker (bookings, returns, expiries…) only gets the universal "real calendar date" check. */
  birthDate?: boolean
  placeholder?: string
  id?: string
  className?: string
  title?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  readOnly,
  clearable,
  birthDate,
  placeholder,
  id,
  className,
  title,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const t = useTranslations("picker")
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)

  const selected = toLocalDate(value)
  const minDate = toLocalDate(min)
  const maxDate = toLocalDate(max)
  const today = todayPR()
  const todayAllowed = (!min || today >= min) && (!max || today <= max)

  // Year dropdown range: far enough back for birth dates, a decade ahead for expiry dates.
  const now = new Date()
  const startMonth = minDate ?? new Date(now.getFullYear() - 110, 0)
  const endMonth = maxDate ?? new Date(now.getFullYear() + 10, 11)

  // Texto escrito a mano: se sincroniza con `value` (patrón "ajustar en render") salvo mientras el
  // campo está enfocado o tiene un error pendiente — si no, el error desaparecía solo al perder el
  // foco porque esto lo pisaba de vuelta al último valor válido antes de que el usuario lo viera.
  const mostrado = formatFechaSolo(value)
  const [texto, setTexto] = React.useState(mostrado)
  const [visto, setVisto] = React.useState(mostrado)
  const [focused, setFocused] = React.useState(false)
  const [error, setError] = React.useState<FechaEscritaError | FechaNacimientoError | "rango" | null>(null)
  if (mostrado !== visto && !focused && !error) {
    setVisto(mostrado)
    setTexto(mostrado)
  }

  function pick(next: string) {
    onChange(next)
    setError(null)
    setOpen(false)
  }

  function commit() {
    setFocused(false)
    const escrito = texto.trim()
    if (!escrito) {
      setError(null)
      if (clearable) onChange("")
      return
    }
    const r = parseFechaEscrita(escrito)
    if (!r.ok) {
      setError(r.razon)
      return
    }
    if (birthDate) {
      const problema = validarFechaNacimiento(r.iso)
      if (problema) {
        setError(problema)
        return
      }
    }
    if ((min && r.iso < min) || (max && r.iso > max)) {
      setError("rango")
      return
    }
    setError(null)
    onChange(r.iso)
  }

  const mensajeError = (e: FechaEscritaError | FechaNacimientoError | "rango"): string =>
    e === "formato" ? t("typedFormat") : e === "invalida" ? t("typedInvalid") : e === "futura" ? t("typedFuture") : e === "edad" ? t("typedAge") : t("typedRange")

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={texto}
        disabled={disabled}
        readOnly={readOnly}
        title={title}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || !!error || undefined}
        aria-describedby={ariaDescribedBy}
        placeholder={placeholder ?? "MM/DD/YYYY"}
        className={cn("h-9 pr-10", readOnly && "pointer-events-none bg-muted/40")}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setTexto(e.target.value)
          setError(null)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          }
        }}
      />
      <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || readOnly}
            aria-label={t("pickDate")}
            className="absolute right-0 top-0 h-9 w-9 text-muted-foreground"
          >
            <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto gap-0 overflow-hidden rounded-lg p-0" align="end">
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
      {error && <p className="mt-1 text-xs text-destructive">{mensajeError(error)}</p>}
    </div>
  )
}

export { DatePicker }
export type { DatePickerProps }
