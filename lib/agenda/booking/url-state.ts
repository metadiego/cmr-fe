// URL state of the booking screen: ?type=medical:<id>|service:<id>&date=YYYY-MM-DD&patient=<id>.

export type BookingKind = "medical" | "service";

export interface BookingUrlState {
  kind?: BookingKind;
  typeId?: string;
  date?: string;
  patientId?: string;
}

function isRealDay(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d, 12));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function parseBookingParams(sp: URLSearchParams): BookingUrlState {
  const out: BookingUrlState = {};
  const type = sp.get("type");
  if (type) {
    const i = type.indexOf(":");
    const kind = type.slice(0, i);
    const id = type.slice(i + 1);
    if (i > 0 && (kind === "medical" || kind === "service") && id) {
      out.kind = kind;
      out.typeId = id;
    }
  }
  const date = sp.get("date");
  if (date && isRealDay(date)) out.date = date;
  const patient = sp.get("patient");
  if (patient) out.patientId = patient;
  return out;
}

export function toBookingSearch(s: BookingUrlState): string {
  const parts: string[] = [];
  if (s.kind && s.typeId) parts.push(`type=${s.kind}:${encodeURIComponent(s.typeId)}`);
  if (s.date) parts.push(`date=${s.date}`);
  if (s.patientId) parts.push(`patient=${encodeURIComponent(s.patientId)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
