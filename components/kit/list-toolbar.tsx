"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Toolbar above a DataTable: a debounced search box on the left, followed by `filters` (selects
// that narrow the list sit next to the search they refine), and actions (`children`) on the right.
// The page owns the query state; this only surfaces changes via onSearchChange.
//
//   <ListToolbar search={q} onSearchChange={setQ} filters={<Select .../>}>
//     <Can permiso="x.create"><Button>New</Button></Can>
//   </ListToolbar>
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  debounceMs = 300,
  filters,
  children,
  className,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  debounceMs?: number;
  filters?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  const [local, setLocal] = React.useState(search ?? "");

  // Sync the input when the parent resets the query externally. React's
  // "adjust state during render" pattern (not an effect) — compares the prop
  // to its previous value and updates in the same render.
  const [prevSearch, setPrevSearch] = React.useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setLocal(search ?? "");
  }

  // Debounce upward propagation so each keystroke doesn't refetch.
  React.useEffect(() => {
    if (!onSearchChange || local === (search ?? "")) return;
    const id = setTimeout(() => onSearchChange(local), debounceMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, debounceMs]);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {onSearchChange && (
        <div className="relative w-full sm:max-w-sm">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={searchPlaceholder ?? t("search")}
            className="pl-8"
          />
        </div>
      )}
      {filters}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
