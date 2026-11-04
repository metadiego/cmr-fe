"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/kit/can";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
import { useResource } from "@/hooks/use-resource";
import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import type { Centro } from "@/lib/api/centers";

// "Who's calling?": find the caller among the patients of every center the user may read (no tenant,
// same as PacienteSelect), or create them. Each result shows what the receptionist checks on the phone:
// name, record, phone and center. Picking one (or saving a new one) hands the patient to the screen.

const DEBOUNCE_MS = 250;
const LIMIT = 8;

export function patientName(p: Paciente): string {
  return p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ");
}

export function WhosCallingPanel({
  centers,
  onPick,
}: {
  /** The centers the screen can show, to name each patient's center. */
  centers: Centro[];
  onPick: (p: Paciente) => void;
}) {
  const t = useTranslations("appointmentsBooking.whosCalling");
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [newOpen, setNewOpen] = React.useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const { state } = useResource(
    () =>
      debounced
        ? listPacientes({ q: debounced, limit: LIMIT })
        : Promise.resolve({ items: [] as Paciente[], pagination: { total: 0, page: 1, limit: LIMIT } }),
    [debounced],
  );

  const centerName = (id: string | null) => (id ? centers.find((c) => c.id === id)?.name : undefined);

  return (
    <section className="flex min-h-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <Can permiso="pacientes.create">
          <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            {t("newPatient")}
          </Button>
        </Can>
      </div>

      <div className="relative">
        <HugeiconsIcon
          icon={Search01Icon}
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          autoComplete="off"
          className="pl-8"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!debounced ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">{t("hint")}</p>
        ) : state.kind === "loading" ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">{t("searching")}</p>
        ) : state.kind === "fail" ? (
          <p className="px-1 py-2 text-sm text-destructive">{t("searchFailed", { message: state.message })}</p>
        ) : state.data.items.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">{t("noResults", { q: debounced })}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {state.data.items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                    {(p.firstName?.[0] ?? "") + (p.lastName?.[0] ?? "")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{patientName(p)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[
                        p.medicalRecordNumber ? t("record", { record: p.medicalRecordNumber }) : t("noRecord"),
                        p.phone || t("noPhone"),
                        centerName(p.clinicId),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PacienteFormSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        onSaved={(saved) => {
          setNewOpen(false);
          onPick(saved);
        }}
      />
    </section>
  );
}
