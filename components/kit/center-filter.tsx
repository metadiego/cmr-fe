"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// A list filter over several centers (e.g. the patient list across every clinic the person can
// read). `selected` null = all of them; unticking down to none, or ticking all, goes back to null.
// It narrows a list; it never moves the session's center (that is the top bar's picker).
export function CenterFilter({
  centers,
  selected,
  onChange,
}: {
  centers: { id: string; name: string }[];
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
}) {
  const t = useTranslations("patients.centerFilter");
  const effective = selected ?? centers.map((c) => c.id);
  const label =
    effective.length === centers.length
      ? t("all")
      : effective.length === 1
        ? (centers.find((c) => c.id === effective[0])?.name ?? t("some", { count: 1 }))
        : t("some", { count: effective.length });

  function toggle(id: string, on: boolean) {
    const next = on ? [...effective, id] : effective.filter((x) => x !== id);
    onChange(next.length === 0 || next.length === centers.length ? null : next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="justify-between gap-2 font-normal" aria-label={t("label")}>
          {label}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {centers.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={effective.includes(c.id)}
            onCheckedChange={(v) => toggle(c.id, v === true)}
            // Keep the menu open so several centers can be ticked in a row.
            onSelect={(e) => e.preventDefault()}
          >
            {c.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
