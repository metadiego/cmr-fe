// The month calendars (medical appointments, services) over every clinic the person can read, with a
// clinic filter (handoff docs/specs/clinic-read-scope-handoff-fe.md). The month reads span the clinics
// shown; what needs ONE clinic (the day view, booking) picks it here.

import { createClinicOf } from "../create-clinic.ts";

/**
 * The one clinic a day view or a booking from the calendar runs in: the filter's single ticked clinic,
 * else the active one (the top bar's, else the session's) when readable, else the first readable one
 * (what the screen picker used to start on). `null` while nothing is known.
 */
export function pickOneClinic(opts: {
  readable: readonly string[];
  choice: readonly string[] | null;
  active: string | null;
  session: string | null;
}): string | null {
  const { readable, choice, active, session } = opts;
  // The one rule for "which ONE clinic" (lib/create-clinic.ts), over the clinics the calendar can show.
  return createClinicOf(choice, readable, active, session) || null;
}

/**
 * Short clinic names for tight spots (a calendar pill, a button): the words every name shares at the
 * start are dropped ("CMR Caguas", "CMR Bayamon" → "Caguas", "Bayamon"). A name that would end up empty
 * keeps its full form.
 */
export function shortClinicNames(names: readonly string[]): Map<string, string> {
  const words = names.map((n) => n.trim().split(/\s+/));
  let shared = 0;
  if (words.length > 1) {
    const first = words[0];
    while (
      shared < first.length &&
      words.every((w) => w.length > shared + 1 && w[shared].toLowerCase() === first[shared].toLowerCase())
    ) {
      shared++;
    }
  }
  return new Map(names.map((n, i) => [n, words[i].slice(shared).join(" ") || n]));
}

export interface HolidayRow {
  clinicId: string | null;
  clinicName?: string | null;
  date: string;
  name: string;
  recursAnnually: boolean;
  active: boolean;
}

export interface DayHoliday {
  /** What the day cell prints: the holiday's name, with whose holiday it is when not every clinic's. */
  label: string;
  /** Every clinic shown is closed (or the holiday has no clinic): tint the whole day as before. */
  allClinics: boolean;
}

/**
 * The holiday of a day over the clinics shown. A holiday is per clinic: with one clinic shown it reads
 * as before; with several, the day is tinted only when EVERY clinic shown has a holiday (or a holiday of
 * no clinic, a global one), otherwise it only says whose holiday it is ("Día X (Caguas)"), so a day that
 * is open in another clinic does not look closed.
 */
export function dayHoliday(
  holidays: readonly HolidayRow[],
  iso: string,
  shownClinicIds: readonly string[],
  shortName: (clinicName: string) => string = (n) => n,
): DayHoliday | null {
  const md = iso.slice(5);
  const today = holidays.filter(
    (h) => h.active && (h.date === iso || (h.recursAnnually && h.date.slice(5) === md)),
  );
  if (today.length === 0) return null;
  const global = today.some((h) => h.clinicId === null);
  const closed = new Set(today.map((h) => h.clinicId).filter((id): id is string => !!id));
  const allClinics =
    global || shownClinicIds.length <= 1 || shownClinicIds.every((id) => closed.has(id));
  if (allClinics) {
    return { label: [...new Set(today.map((h) => h.name))].join(", "), allClinics };
  }
  const label = today
    .map((h) => (h.clinicName ? `${h.name} (${shortName(h.clinicName)})` : h.name))
    .join(", ");
  return { label, allClinics };
}

export interface ServiceOption {
  /** Select value: the service's name, the same service in each clinic being its own row. */
  key: string;
  name: string;
  color: string | null;
  /** The service rows of that name, one per clinic shown. */
  ids: string[];
}

/**
 * Services are a row PER CLINIC (same name, own id). With several clinics shown the filter and the
 * legend list each service once by name; picking it covers that service in every clinic shown. The
 * first row's color stands for the name (the legend, in catalog order).
 */
export function servicesByName(
  services: readonly { id: string; name: string; color?: string | null }[],
): ServiceOption[] {
  const byName = new Map<string, ServiceOption>();
  for (const s of services) {
    const key = s.name.trim().toLowerCase();
    const opt = byName.get(key);
    if (opt) opt.ids.push(s.id);
    else byName.set(key, { key, name: s.name, color: s.color ?? null, ids: [s.id] });
  }
  return [...byName.values()];
}
