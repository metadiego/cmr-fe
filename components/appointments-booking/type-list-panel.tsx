"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResource } from "@/hooks/use-resource";
import type { BookingTypes } from "@/hooks/use-booking-types";
import type { PatientBookingRules } from "@/hooks/use-patient-booking-rules";
import { TypeListRow } from "@/components/appointments-booking/type-list-row";
import {
  bookableServicesList,
  filterMedicalTypes,
  NEXT_OPENING_DAYS,
  patientServicesView,
  typeListGroups,
  type TypeListGroupKey,
} from "@/lib/agenda/booking/type-list";
import type { BookingKind } from "@/lib/agenda/booking/url-state";
import { getBookingHolidays } from "@/lib/api/festivos";
import { inDaysPR, todayPR } from "@/lib/format/fecha";
import { ErrorState, Panel } from "@/components/kit/panel";
import { LoadingRegion } from "@/components/kit/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// "What are we booking?": a searchable list (accent- and case-insensitive) of the medical appointment
// types and the center's services, each row with its next free time. With a patient chosen, the booking
// rules apply (spec 2026-11-23-appointments-booking-upgrades §4): the medical types follow whether they
// were attended before (first visit vs follow-up), and the only services listed are those they can
// still book (bookable sessions > 0, packages from any center), in one "<name>'s services" group. Never
// a fallback to every service: while that balance loads the group shows skeleton rows, on failure an
// error with retry. Keyboard: ↓ from the search goes into the list, ↑/↓ move through rows, Enter picks
// (in the search: the first row).
// Spec: docs/specs/2026-11-04-appointments-booking-views-and-type-list.md §2.

export function TypeListPanel({
  title,
  center,
  patientId,
  patientName,
  types,
  rules,
  onPick,
}: {
  title: string;
  /** The booking center (where the picked type is booked). */
  center: string | undefined;
  patientId?: string;
  /** The patient's first name, for the "Ana's services" group. */
  patientName?: string;
  /** Loaded once by the screen (useBookingTypes) and shared with the toolbar chip. */
  types: BookingTypes;
  /** The chosen patient's booking rules (usePatientBookingRules), owned by the screen. */
  rules: PatientBookingRules;
  onPick: (kind: BookingKind, typeId: string) => void;
}) {
  const t = useTranslations("appointmentsBooking");
  const [query, setQuery] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const patientMode = !!patientId;
  const { bookable, bookableState } = rules;
  // With a patient and no answer yet ("idle" too: the screen waits for the patient's centers), the
  // services group is unknown, never "every service". Without permission to read the services or the
  // balance it says so (no read is made, no error shown).
  const servicesView = patientServicesView({
    hidden: types.servicesHidden || rules.bookableHidden,
    bookableState,
  });
  const bookableUnknown = patientMode && servicesView === "loading";

  // The scans' days skip the center's holidays: this year's, and next year's near the turn of the year.
  const years = [...new Set([todayPR(), inDaysPR(NEXT_OPENING_DAYS * 2)].map((d) => Number(d.slice(0, 4))))];
  const holidaysRes = useResource<string[]>(
    () =>
      center
        ? getBookingHolidays(years, center)
        : Promise.resolve([]),
    [center, years.join(",")],
  );
  // A failed holiday load must not block the list: the day requests then say what is closed.
  const holidays =
    holidaysRes.state.kind === "ok" ? holidaysRes.state.data : holidaysRes.state.kind === "fail" ? [] : null;

  const groups = patientMode
    ? typeListGroups({
        medical: filterMedicalTypes(types.medical, rules.visitKind),
        services: bookableServicesList(types.services, bookable) ?? [],
        query,
        patientMode,
      })
    : typeListGroups({ medical: types.medical, services: types.services, query });
  // The patient's services group stays on screen (skeleton or error) while its balance is unknown,
  // even when a search would drop it as empty.
  if (bookableUnknown && !groups.some((g) => g.key === "patientServices")) {
    groups.push({ key: "patientServices", items: [] });
  }
  const groupLabel: Record<TypeListGroupKey, string> = {
    medical: t("typePicker.medicalGroup"),
    packages: t("typePicker.packages"),
    services: t("typePicker.serviceGroup"),
    patientServices: patientName ? t("typePicker.patientServices", { name: patientName }) : t("typePicker.serviceGroup"),
  };
  const noServices = types.servicesHidden ? t("typePicker.noServicesPermission") : t("typePicker.noServices");
  const emptyLabel: Record<TypeListGroupKey, string> = {
    medical: t("typePicker.noMedical"),
    packages: "",
    services: noServices,
    patientServices: types.servicesHidden
      ? noServices
      : rules.bookableHidden
        ? t("typePicker.noBookablePermission")
        : t("typePicker.noBookable"),
  };
  // Another center's name for each service whose bookable sessions were bought there.
  const otherCentersOf = (serviceId: string) =>
    bookable
      ?.get(serviceId)
      ?.sources.filter((s) => s.centerId !== center && s.bookable > 0)
      .map((s) => s.centerName);

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
    <Panel className="flex min-h-0 flex-col gap-3 p-4">
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
                  {g.key === "patientServices" && servicesView === "fail" ? (
                    <div className="flex flex-col items-start gap-2">
                      <ErrorState message={t("typePicker.bookableFailed")} />
                      <Button variant="outline" size="sm" onClick={rules.reloadBookable}>
                        {t("retry")}
                      </Button>
                    </div>
                  ) : g.key === "patientServices" && bookableUnknown ? (
                    <LoadingRegion className="flex flex-col gap-1.5">
                      {Array.from({ length: 3 }, (_, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-card px-3 py-2"
                        >
                          <Skeleton className="h-8 w-1 rounded-full" />
                          <span className="flex flex-col gap-1.5">
                            <Skeleton className={i % 2 ? "h-4 w-28" : "h-4 w-36"} />
                            <Skeleton className="h-3 w-20" />
                          </span>
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))}
                    </LoadingRegion>
                  ) : g.items.length === 0 ? (
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
                          sessionsLeft={patientMode && x.kind === "service" ? (bookable?.get(x.id)?.bookable ?? 0) : 0}
                          otherCenters={patientMode && x.kind === "service" ? otherCentersOf(x.id) : undefined}
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
    </Panel>
  );
}
