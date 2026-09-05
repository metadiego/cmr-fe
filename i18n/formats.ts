// i18n/formats.ts
// Named date/time and number formats shared by EVERY locale-aware render.
//
// Why this file exists: formatting used to be built ad hoc at ~20 call sites. Half of
// them pinned a locale ("es-PR") and half passed `undefined`, which means the BROWSER's
// language — neither follows the language picker. So an English session still showed
// "septiembre 2026" on calendar headers and "lunes, 4 de septiembre" in the day view.
// Naming the formats once, here, is what makes the picker switch the whole UI.
//
// Imported by BOTH sides of the RSC boundary on purpose:
//   - i18n/request.ts              → Server Components (getFormatter)
//   - components/intl-provider.tsx → Client Components (useFormatter)
// NextIntlClientProvider cannot inherit these across the boundary, so the identical
// object has to be handed to it explicitly or client and server would drift.
//
// NOT in here, deliberately:
//   - 24-hour clocks (`hour12: false`). Their output is digits only — "14:30" is byte
//     for byte identical in es and en — so they carry no language, and several sites
//     pin them as a documented contract. Making them locale-aware would turn 24h into
//     "02:30 PM" in English: a regression, not a fix.
//   - Money. It is USD in every language and invoices must not shift.

// The business runs in Puerto Rico (AST). The BE seals timestamps in UTC and they must
// always render in CLINIC time, never the viewer's machine.
export const BUSINESS_TIME_ZONE = "America/Puerto_Rico";

export const formats = {
  dateTime: {
    // ---- INSTANTS -------------------------------------------------------------
    // A real moment in time (BE `timestamptz`). Rendered in clinic time, which the
    // global `timeZone` supplies — these deliberately do NOT pin one themselves.

    // 12-hour wall clock: "02:30 p. m." / "02:30 PM". The AM/PM marker IS translated,
    // which is precisely why it must never be pinned to a single locale.
    time: { hour: "2-digit", minute: "2-digit", hour12: true },
    // Audit / history rows: calendar date + wall clock in one string.
    dateAndTime: {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    },

    // ---- CALENDAR DAYS --------------------------------------------------------
    // A "YYYY-MM-DD" from the BE is a DAY, not a moment. Rendering it in a timezone
    // is what produces the "invoice shows yesterday" bug this repo already documents
    // in lib/format/fecha.ts. So every day-only format pins UTC and is fed a date
    // built with `parseDayUTC`, which anchors the day at UTC noon. The pair is what
    // makes the output exact in every timezone.
    dayShort: { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" },
    // "4 de septiembre de 2026" / "September 4, 2026"
    dayLong: { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
    // Calendar headers: "septiembre de 2026" / "September 2026"
    monthYear: { month: "long", year: "numeric", timeZone: "UTC" },
    // Day-view heading: "jueves, 4 de septiembre de 2026" / "Thursday, September 4, 2026"
    dayWeekdayLong: {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
    // Compact chips: "4 sept" / "Sep 4"
    dayMonth: { day: "numeric", month: "short", timeZone: "UTC" },
    // "4 sept 2026" / "Sep 4, 2026"
    dayMonthYear: { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
    // "jue, 4 sept" / "Thu, Sep 4"
    dayWeekdayShort: { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" },
  },
  number: {
    currency: { style: "currency", currency: "USD" },
    decimal2: { maximumFractionDigits: 2 },
    integer: { maximumFractionDigits: 0 },
  },
} as const;
