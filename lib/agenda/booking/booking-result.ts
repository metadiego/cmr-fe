export interface BookingResultItem {
  date: string;
  time: string;
  typeName: string;
  kind: "medical" | "service";
  doctor?: string | null;
  from?: { date: string; time: string };
}

export interface BookingResult {
  mode: "booked" | "moved";
  patient: { name: string; record?: string | null };
  center: { name: string; phone?: string | null; address?: string | null };
  items: BookingResultItem[];
  skipped: { date: string; reason: string }[];
  warnings: string[];
}

/** Sorts by date+time, dedupes identical date+time+typeName, drops skipped dates that were also created. */
export function buildBookingResult(input: BookingResult): BookingResult {
  const seen = new Set<string>();
  const items = [...input.items]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .filter((i) => {
      const key = `${i.date}|${i.time}|${i.typeName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const created = new Set(items.map((i) => i.date));
  return { ...input, items, skipped: input.skipped.filter((s) => !created.has(s.date)) };
}
