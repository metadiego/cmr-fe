import type { HorarioMedico, Festivo } from "@/lib/api/disponibilidad";

// ---- Dates (local; ISO "YYYY-MM-DD") ---------------------------------------

export function toISO(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function dayOfWeek(iso: string): number {
  return parseISO(iso).getDay(); // 0=Sun..6=Sat
}

// Weeks (Sun→Sat) covering the given month, including leading/trailing days.
export function monthMatrix(year: number, month0: number): Date[][] {
  const first = new Date(year, month0, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back to Sunday
  const weeks: Date[][] = [];
  const cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    // Stop after we've passed the month and completed a week.
    if (cur.getMonth() !== month0 && cur > new Date(year, month0 + 1, 0)) break;
  }
  return weeks;
}

export function isFestivo(festivos: Festivo[], iso: string): Festivo | null {
  const md = iso.slice(5); // MM-DD
  for (const f of festivos) {
    if (!f.activo) continue;
    if (f.fecha === iso) return f;
    if (f.recurrenteAnual && f.fecha.slice(5) === md) return f;
  }
  return null;
}

// ---- Times ("HH:mm") --------------------------------------------------------

export function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(hhmm: string, min: number): string {
  return minToTime(timeToMin(hhmm) + min);
}

function overlaps(aS: string, aE: string, bS: string, bE: string): boolean {
  return timeToMin(aS) < timeToMin(bE) && timeToMin(aE) > timeToMin(bS);
}

// Bookable start times for a day: within the doctor's working hours for that
// weekday, stepped by slotDuration, excluding slots whose [start, start+dur)
// would overlap an existing busy interval. Empty hours → [] (no constraint).
export function generarSlots(opts: {
  horarios: HorarioMedico[];
  fecha: string; // ISO
  slotDuration: number; // minutes (step)
  duracion: number; // minutes the new cita lasts
  ocupados: Array<{ hora: string; horaFin: string }>;
}): string[] {
  const dow = dayOfWeek(opts.fecha);
  const dayHours = opts.horarios.filter((h) => h.activo && h.diaSemana === dow);
  if (dayHours.length === 0) return [];
  const slots: string[] = [];
  for (const h of dayHours) {
    for (
      let t = timeToMin(h.horaInicio);
      t + opts.duracion <= timeToMin(h.horaFin);
      t += opts.slotDuration
    ) {
      const start = minToTime(t);
      const end = minToTime(t + opts.duracion);
      const busy = opts.ocupados.some((o) =>
        overlaps(start, end, o.hora, o.horaFin),
      );
      if (!busy) slots.push(start);
    }
  }
  return slots;
}

// Event color precedence: cita → tipo → doctor → fallback.
export function colorDeEvento(
  citaColor?: string | null,
  tipoColor?: string | null,
  medicoColor?: string | null,
): string {
  return citaColor || tipoColor || medicoColor || "#4a90d9";
}
