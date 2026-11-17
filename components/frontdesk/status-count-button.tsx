"use client"

import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Button } from "@/components/ui/button"

// One look for every live status button on the front desk (location, free doctors, nurses,
// technicians): a quiet icon plus its count, always shown so the row does not jump. Works as the
// child of a Radix trigger (`asChild`): props and ref are passed through to the Button.
export function StatusCountButton({
  icon,
  count,
  label,
  ...props
}: { icon: IconSvgElement; count: number; label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      aria-label={label}
      title={label}
      {...props}
    >
      <HugeiconsIcon icon={icon} className="size-4 text-muted-foreground" />
      <span className="font-medium text-foreground tabular-nums">{count}</span>
    </Button>
  )
}
