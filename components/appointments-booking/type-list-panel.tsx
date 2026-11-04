"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResource } from "@/hooks/use-resource";
import type { BookingTypes } from "@/hooks/use-booking-types";
import { TypeListRow } from "@/components/appointments-booking/type-list-row";
import { holidayDates } from "@/lib/agenda/booking/holidays";
import { NEXT_OPENING_DAYS } from "@/hooks/use-next-opening";
import { typeListGroups, type TypeListGroupKey } from "@/lib/agenda/booking/type-list";
import type { BookingKind } from "@/lib/agenda/booking/url-state";
import { getServiciosConSaldo, type ServicioConSaldo } from "@/lib/api/frontdesk";
import { getFestivos } from "@/lib/api/festivos";
import { inDaysPR, todayPR } from "@/lib/format/fecha";

// "What are we booking?": a searchable list (accent- and case-insensitive) of the medical appointment
// types and the center's services, each row with its next free time. With a patient chosen, the services
// they still have paid sessions of come first among the services, in their own group, so the
// receptionist books what was bought (GET /frontdesk/patients/:id/availability). Keyboard: ↓ from the
// search goes into the list, ↑/↓ move through rows, Enter picks (in the search: the first row).
// Spec: docs/specs/2026-11-04-appointments-booking-views-and-type-list.md §2.

export function TypeListPanel({
  title,
  center,
  patientId,
  patientName,
  types,
  onPick,
}: {
  title: string;
  center: string | undefined;
  patientId?: string;
  /** The patient's first name, for the "Ana's packages" group. */
  patientName?: string;
  /** Loaded once by the screen (useBookingTypes) and shared with the toolbar chip. */
  types: BookingTypes;
  onPick: (kind: BookingKind, typeId: string) => void;
}) {
  const t = useTranslations("appointmentsBooking");
  const [query, setQuery] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const saldoRes = useResource<ServicioConSaldo[]>(
    () => (patientId && center ? getServiciosConSaldo(patientId, center) : Promise.resolve([])),
    [patientId, center],
  );
  const left = React.useMemo(() => {
    const m = new Map<string, number>();
    if (saldoRes.state.kind === "ok") for (const s of saldoRes.state.data) m.set(s.serviceId, s.pending);
    return m;
  }, [saldoRes.state]);

  // The scans' days skip the center's holidays: this year's, and next year's near the turn of the year.
  const years = [...new Set([todayPR(), inDaysPR(NEXT_OPENING_DAYS * 2)].map((d) => Number(d.slice(0, 4))))];
  const holidaysRes = useResource<string[]>(
    () =>
      center
        ? Promise.all(years.map((anio) => getFestivos({ anio, centroId: center }))).then((l) => holidayDates(l.flat()))
        : Promise.resolve([]),
    [center, years.join(",")],
  );
  // A failed holiday load must not block the list: the day requests then say what is closed.
  const holidays =
    holidaysRes.state.kind === "ok" ? holidaysRes.state.data : holidaysRes.state.kind === "fail" ? [] : null;

  const groups = typeListGroups({ medical: types.medical, services: types.services, packages: left, query });
  const groupLabel: Record<TypeListGroupKey, string> = {
    medical: t("typePicker.medicalGroup"),
    packages: patientName ? t("typePicker.packagesOf", { name: patientName }) : t("typePicker.packages"),
    services: t("typePicker.serviceGroup"),
  };
  const emptyLabel: Record<TypeListGroupKey, string> = {
    medical: t("typePicker.noMedical"),
    packages: "",
    services: t("typePicker.noServices"),
  };

  const rows = () => [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-type-row]") ?? [])];
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const all = rows();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    all[Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), all.length - 1)]?.focus();
  };
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      rows()[0]?.focus();
    } else if (e.key === "Enter") {
      const first = groups.find((g) => g.items.length > 0)?.items[0];
      if (first) {
        e.preventDefault();
        onPick(first.kind, first.id);
      }
    }
  };

  const loading = types.loading && types.medical.length === 0 && types.services.length === 0;

  return (
    <section className="flex min-h-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="text-base font-semibold">{title}</h2>

      {types.error ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>{t("loadFailed", { message: types.error })}</span>
          <Button variant="outline" size="sm" onClick={types.reload}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder={t("typePicker.searchPlaceholder")}
            aria-label={t("typePicker.searchLabel")}
            autoComplete="off"
          />
          <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-0.5 py-0.5" onKeyDown={onListKey}>
            {loading ? (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("typePicker.noMatches", { q: query.trim() })}</p>
            ) : (
              groups.map((g) => (
                <div key={g.key} className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {groupLabel[g.key]}
                  </h3>
                  {g.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {types.loading ? t("loading") : emptyLabel[g.key]}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {g.items.map((x) => (
                        <TypeListRow
                          key={`${x.kind}:${x.id}`}
                          type={x}
                          center={center}
                          holidays={holidays}
                          sessionsLeft={x.kind === "service" ? (left.get(x.id) ?? 0) : 0}
                          onPick={onPick}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
