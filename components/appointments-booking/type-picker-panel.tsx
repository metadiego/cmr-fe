"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import type { BookingType, BookingTypes } from "@/hooks/use-booking-types";
import type { BookingKind } from "@/lib/agenda/booking/url-state";
import { getServiciosConSaldo, type ServicioConSaldo } from "@/lib/api/frontdesk";

// "What are we booking?": the medical appointment types and the center's services, each with its
// colour. With a patient chosen, a service the patient still has paid sessions of says how many are
// left (GET /frontdesk/patients/:id/availability), so the receptionist books what was bought.

export function TypePickerPanel({
  title,
  center,
  patientId,
  types,
  onPick,
}: {
  title: string;
  center: string | undefined;
  patientId?: string;
  /** Loaded once by the screen (useBookingTypes) and shared with the toolbar chip. */
  types: BookingTypes;
  onPick: (kind: BookingKind, typeId: string) => void;
}) {
  const t = useTranslations("appointmentsBooking");

  const saldoRes = useResource<ServicioConSaldo[]>(
    () => (patientId && center ? getServiciosConSaldo(patientId, center) : Promise.resolve([])),
    [patientId, center],
  );
  const left = React.useMemo(() => {
    const m = new Map<string, number>();
    if (saldoRes.state.kind === "ok") for (const s of saldoRes.state.data) m.set(s.serviceId, s.pending);
    return m;
  }, [saldoRes.state]);

  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="text-base font-semibold">{title}</h2>

      {types.error ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>{t("loadFailed", { message: types.error })}</span>
          <Button variant="outline" size="sm" onClick={types.reload}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <TypeGroup
            label={t("typePicker.medicalGroup")}
            empty={t("typePicker.noMedical")}
            loading={types.loading && types.medical.length === 0}
            loadingLabel={t("loading")}
            items={types.medical}
            onPick={onPick}
          />
          <TypeGroup
            label={t("typePicker.serviceGroup")}
            empty={t("typePicker.noServices")}
            loading={types.loading && types.services.length === 0}
            loadingLabel={t("loading")}
            items={types.services}
            badge={(x) => {
              const n = left.get(x.id) ?? 0;
              return n > 0 ? t("typePicker.sessionsLeft", { n }) : null;
            }}
            onPick={onPick}
          />
        </div>
      )}
    </section>
  );
}

function TypeGroup({
  label,
  empty,
  loading,
  loadingLabel,
  items,
  badge,
  onPick,
}: {
  label: string;
  empty: string;
  loading: boolean;
  loadingLabel: string;
  items: BookingType[];
  badge?: (x: BookingType) => string | null;
  onPick: (kind: BookingKind, typeId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
      {loading ? (
        <p className="text-sm text-muted-foreground">{loadingLabel}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((x) => {
            const extra = badge?.(x) ?? null;
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => onPick(x.kind, x.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span
                    className="size-3 shrink-0 rounded-full bg-muted-foreground/40"
                    style={x.color ? { backgroundColor: x.color } : undefined}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                  {extra && (
                    <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      {extra}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
