"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Async patient picker: type to search (server-side `q`), click a result to
// select. Once selected, shows the patient with a "change" affordance.
export function PacienteSelect({
  value,
  onChange,
}: {
  value: Paciente | null;
  onChange: (p: Paciente | null) => void;
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
        ? listPacientes({ q: debounced, limit: 8 })
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 8 } }),
    [debounced],
  );

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <span className="truncate text-sm font-medium">
          {[value.nombres, value.apellidos].filter(Boolean).join(" ")}
          {value.docId && (
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              ID {value.docId}
            </span>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
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
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
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
                  {[p.nombres, p.apellidos].filter(Boolean).join(" ")}
                </span>
                {p.docId && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.docId}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
