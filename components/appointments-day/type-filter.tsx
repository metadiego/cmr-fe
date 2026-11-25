"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { UnfoldMoreIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TypeOption } from "@/lib/appointments-day/day-list";

// The Citas screen's "Type" picker: several medical types and therapy services at once, grouped
// (Consultations / Therapies); nothing picked = no type filter.
export function TypeFilter({
  options,
  picked,
  onChange,
}: {
  /** null while the types and services load. */
  options: TypeOption[] | null;
  picked: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("appointmentsDay.typeFilter");
  const medical = options?.filter((o) => o.kind === "medical") ?? [];
  const services = options?.filter((o) => o.kind === "service") ?? [];
  const shown = options?.filter((o) => picked.includes(o.id)) ?? [];
  const summary = shown.length === 0 ? t("any") : shown.length === 1 ? shown[0].label : t("count", { count: shown.length });
  const toggle = (id: string, on: boolean) => onChange(on ? [...picked, id] : picked.filter((p) => p !== id));

  const group = (label: string, list: TypeOption[]) =>
    list.length > 0 && (
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </DropdownMenuLabel>
        {list.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.id}
            checked={picked.includes(o.id)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => toggle(o.id, on)}
          >
            <span className="truncate">{o.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuGroup>
    );

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("label")}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-44 justify-between font-normal"
            disabled={options === null}
            aria-label={t("label")}
          >
            <span className="truncate">{summary}</span>
            <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
          {options !== null && options.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">{t("empty")}</p>
          )}
          {group(t("medical"), medical)}
          {medical.length > 0 && services.length > 0 && <DropdownMenuSeparator />}
          {group(t("therapies"), services)}
          {picked.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onChange([])}>{t("clear")}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
