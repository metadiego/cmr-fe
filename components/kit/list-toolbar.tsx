"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Toolbar above a DataTable: a debounced search box on the left and arbitrary
// filter controls / actions (selects, buttons) on the right. The page owns the
// query state; this only surfaces changes via onSearchChange.
//
//   <ListToolbar search={q} onSearchChange={setQ}>
//     <Select .../>            // filters
//     <Can permiso="x.create"><Button>New</Button></Can>
//   </ListToolbar>
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  debounceMs = 300,
  children,
  className,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  debounceMs?: number;
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
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={searchPlaceholder ?? t("search")}
          className="max-w-xs"
        />
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
