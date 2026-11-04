"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Async patient picker: type to search (server-side `q`), click a result to
// select. Once selected, shows the patient with a "change" affordance.
// `centerIds`: search in those centers instead of only the session's (X-Tenant-ID).
export function PacienteSelect({
  value,
  onChange,
  centerIds,
}: {
  value: Paciente | null;
  onChange: (p: Paciente | null) => void;
  centerIds?: string[];
}) {
  const t = useTranslations("appointments");
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [open, setOpen] = React.useState(false);

  // Debounce the query that drives the search request.
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const { state } = useResource(
    () =>
      debounced.length >= 1
        ? listPacientes({ q: debounced, limit: 8, ...(centerIds?.length ? { centerIds } : {}) })
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 8 } }),
    [debounced, centerIds?.join(",") ?? ""],
  );

  if (value) {
    return (
      // Same h-9 box as the inputs/selects around it, so form rows line up.
      <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-input/30 pr-1 pl-3">
        <span className="truncate text-sm font-medium">
          {(value.displayName || [value.firstName, value.lastName].filter(Boolean).join(" "))}
          {value.documentId && (
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              ID {value.documentId}
            </span>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={() => {
            onChange(null);
            setQuery("");
            setOpen(false);
          }}
        >
          {t("changePatient")}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("searchPatient")}
        autoComplete="off"
      />
      {open && debounced.length >= 1 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {state.kind === "loading" && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("searching")}</p>
          )}
          {state.kind === "ok" && state.data.items.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("noPatients")}</p>
          )}
          {state.kind === "ok" &&
            state.data.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">
                  {(p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" "))}
                </span>
                {p.documentId && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.documentId}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
