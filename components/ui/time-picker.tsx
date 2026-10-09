"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Drop-in replacement for `<Input type="time">`: same 24h "HH:mm" string in and out. The trigger
// shows the time in the app's language (12h with a translated AM/PM, like the rest of the app),
// while the stored value stays the 24h wall-clock string the BE expects.

const TIME = /^(\d{1,2}):(\d{2})/

function parse(v: string | undefined): { h: number; m: number } | null {
  const match = v?.match(TIME)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  return h < 24 && m < 60 ? { h, m } : null
}

const pad = (n: number) => String(n).padStart(2, "0")

type TimePickerProps = {
  value: string
  onChange: (value: string) => void
  /** Minute granularity of the list. A stored value off the grid is still shown and kept. */
  step?: number
  /** Adds a "Clear" action, for optional times. */
  clearable?: boolean
  disabled?: boolean
  placeholder?: string
  id?: string
  className?: string
  "aria-label"?: string
  "aria-invalid"?: boolean
}

function TimePicker({
  value,
  onChange,
  step = 5,
  clearable,
  disabled,
  placeholder,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: TimePickerProps) {
  const t = useTranslations("picker")
  const format = useFormatter()
  const [open, setOpen] = React.useState(false)

  const current = parse(value)
  const h24 = current?.h ?? null
  const minute = current?.m ?? null
  const isPm = h24 !== null && h24 >= 12
  const h12 = h24 === null ? null : h24 % 12 || 12

  // 12-hour clock order: 12, 1, 2 … 11.
  const hours = [12, ...Array.from({ length: 11 }, (_, i) => i + 1)]
  const grid = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step)
  const minutes =
    minute !== null && !grid.includes(minute) ? [...grid, minute].sort((a, b) => a - b) : grid

  // Anchored in UTC and formatted in UTC: only the wall-clock digits matter, never a timezone.
  const label = (h: number, m: number, opts: { hour: "numeric" | "2-digit"; minute?: "2-digit"; hour12: boolean }) =>
    format.dateTime(new Date(Date.UTC(2000, 0, 1, h, m)), { ...opts, timeZone: "UTC" })
  const meridiem = (pm: boolean) =>
    label(pm ? 12 : 0, 0, { hour: "numeric", hour12: true })
      .replace(/[\d\s]/g, "")
      .trim()

  function set(next: { h12?: number; m?: number; pm?: boolean }) {
    const baseH12 = next.h12 ?? h12 ?? 12
    const pm = next.pm ?? (h24 === null ? false : isPm)
    const h = (baseH12 % 12) + (pm ? 12 : 0)
    onChange(`${pad(h)}:${pad(next.m ?? minute ?? 0)}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          data-empty={!current}
          className={cn(
            "h-9 w-full justify-start px-3 text-left font-normal tabular-nums data-[empty=true]:text-muted-foreground",
            className,
          )}
        >
          <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} data-icon="inline-start" />
          <span className="truncate">
            {current
              ? label(current.h, current.m, { hour: "numeric", minute: "2-digit", hour12: true })
              : (placeholder ?? t("pickTime"))}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 overflow-hidden rounded-lg p-0" align="start">
        <div className="flex h-64 divide-x">
          <Column label={t("hour")}>
            {hours.map((h) => (
              <Cell key={h} active={h === h12} onClick={() => set({ h12: h })}>
                {pad(h)}
              </Cell>
            ))}
          </Column>
          <Column label={t("minute")}>
            {minutes.map((m) => (
              <Cell key={m} active={m === minute} onClick={() => set({ m })}>
                {pad(m)}
              </Cell>
            ))}
          </Column>
          <Column label={t("period")}>
            {[false, true].map((pm) => (
              <Cell key={String(pm)} active={h24 !== null && pm === isPm} onClick={() => set({ pm })}>
                {meridiem(pm)}
              </Cell>
            ))}
          </Column>
        </div>
        {clearable && value ? (
          <div className="flex border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
            >
              {t("clear")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  // Bring the selected entry into view when the popover opens, without scrolling the page.
  React.useEffect(() => {
    const list = ref.current
    const active = list?.querySelector<HTMLElement>("[data-active=true]")
    if (list && active) list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2
  }, [])
  return (
    <div className="flex w-[4.5rem] flex-col">
      <div className="border-b px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">{label}</div>
      <div ref={ref} role="listbox" aria-label={label} className="relative flex flex-1 flex-col gap-0.5 overflow-y-auto p-1">
        {children}
      </div>
    </div>
  )
}

function Cell({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      role="option"
      aria-selected={active}
      data-active={active}
      variant={active ? "default" : "ghost"}
      size="sm"
      className="w-full shrink-0 tabular-nums"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export { TimePicker }
export type { TimePickerProps }
