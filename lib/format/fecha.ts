// Formateo de fechas SOLO-DÍA sin corrimiento de zona horaria.
//
// El BE devuelve fechas de columna `date` como "YYYY-MM-DD" (sin hora). `new Date("2026-07-21")` las
// parsea como UTC medianoche; al mostrarlas en la zona de PR (AST, UTC-4) retroceden a 2026-07-20 → la
// factura de hoy aparece "un día antes". Solución: formatear el string directo (nunca `new Date(str)` para
// solo-día). Negocio USA/PR → formato MM/DD/YYYY. Ver .personal/HANDOFF-fecha-factura-off-by-one.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

// "2026-07-21" (o "2026-07-21T...") → "07/21/2026", sin pasar por Date (cero corrimiento de zona).
// Datetime completo → usa componentes LOCALES (no UTC). Vacío/ inválido → "".
export function formatFechaSolo(v: unknown): string {
  if (v == null || v === "") return "";
  const s = String(v);
  const m = s.match(DATE_ONLY);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

// A calendar day ("2026-07-21") turned into a Date to hand to the day-only formats in
// i18n/formats.ts (`dayLong`, `monthYear`, `dayWeekdayLong`, ...), which all pin UTC.
//
// The anchor is UTC NOON, not midnight: UTC midnight falls on the previous day for any
// zone to the west (PR is UTC-4), and LOCAL midnight — what the old
// `new Date(iso + "T00:00:00")` pattern produced — falls on the previous day for any
// browser to the east. UTC noon is the same calendar day in both directions (a 12h
// margin either way), so pairing "UTC noon" with "format pinned to UTC" always prints
// the intended day, on every machine.
//
// Accepts "YYYY-MM-DD" and full datetimes (takes their day part). Invalid -> null.
export function parseDayUTC(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const m = String(v).match(DATE_ONLY);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isNaN(d.getTime()) ? null : d;
}

// "Today" in the CLINIC's timezone (America/Puerto_Rico, UTC-4, no DST) — never the browser's / server's.
// `new Date().toISOString()` is UTC: from 8pm to midnight AST that's already tomorrow, so any "today"
// derived that way silently drifts a day late in the evening (found live, 2026-09-26 — see
// components/agenda/therapy-day-scheduler.tsx and lib/agenda/recurring-plan.ts).
export function todayPR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date());
}

// `todayPR()` + N days, same day-only YYYY-MM-DD shape.
export function inDaysPR(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(d);
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}
function diasEnMes(anio: number, mes: number): number {
  return mes === 2 && esBisiesto(anio) ? 29 : DIAS_POR_MES[mes - 1];
}

export type FechaEscritaError = "formato" | "invalida";
export type FechaEscritaResultado = { ok: true; iso: string } | { ok: false; razon: FechaEscritaError };

// Fecha TECLEADA a mano: MM/DD/AAAA, MM-DD-AAAA, o MMDDAAAA sin separadores (negocio USA/PR,
// NUNCA DD/MM). Valida SOLO que sea una fecha de calendario real (no 30 de febrero) antes de
// devolver el "YYYY-MM-DD" que espera el BE — puro aritmético, sin pasar por `new Date(str)` —
// mismo cuidado de zona que el resto del archivo. Universal: una cita o un vencimiento futuro es
// una fecha VÁLIDA aquí. `validarFechaNacimiento` abajo es la capa aparte para cuando el campo es
// específicamente una fecha de nacimiento (nunca futura, edad sensata) — bug real, owner
// 17-nov-2026: aplicar esas dos reglas al DatePicker genérico rompía "reservar cita".
export function parseFechaEscrita(texto: string): FechaEscritaResultado {
  const limpio = texto.trim();
  const partes = limpio.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/) ?? limpio.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!partes) return { ok: false, razon: "formato" };
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  const anio = Number(partes[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasEnMes(anio, mes)) return { ok: false, razon: "invalida" };
  const iso = `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return { ok: true, iso };
}

export type FechaNacimientoError = "futura" | "edad";

// Reglas que SOLO valen para una fecha de NACIMIENTO: nunca futura, edad sensata (0-120). Se
// aplican aparte de `parseFechaEscrita` (que no sabe nada de esto) — el DatePicker solo las llama
// cuando el campo lleva `birthDate`.
export function validarFechaNacimiento(iso: string): FechaNacimientoError | null {
  const hoy = todayPR();
  if (iso > hoy) return "futura";
  const [hy, hm, hd] = hoy.split("-").map(Number);
  const [anio, mes, dia] = iso.split("-").map(Number);
  const edad = hy - anio - (hm < mes || (hm === mes && hd < dia) ? 1 : 0);
  return edad > 120 ? "edad" : null;
}

// Current wall-clock time in the clinic's timezone, "HH:mm" (24h) — for gating "don't offer a time
// that's already passed today" without going through the browser's local zone.
export function nowTimePR(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Puerto_Rico",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}
