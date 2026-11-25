// The patient-facing appointment sheet printed after a booking or a move. It has its own layout (not
// the reports' letterhead): black and white only, because the front desks print it on mono printers,
// with the house logo in black. Every string arrives already translated and formatted; this module
// only lays it out and escapes it. Pure: tested in appointment-sheet.test.ts.

import { escapeHtml } from "../../reports/print-document.ts";

export interface AppointmentSheetRow {
  /** Date tile pieces: "mié" / "9" / "dic". */
  weekday: string;
  day: string;
  month: string;
  /** "miércoles, 9 de diciembre de 2026". */
  dateLong: string;
  time: string;
  service: string;
  doctor?: string | null;
  /** "Antes: mar, 24 nov · 9:00" for a moved appointment. */
  movedFrom?: string | null;
}

export interface AppointmentSheetInput {
  lang: string;
  logoUrl: string;
  center: { name: string; address?: string | null; phone?: string | null };
  heading: string;
  patientName: string;
  /** Already labelled: "Récord 1234". */
  record?: string | null;
  rows: AppointmentSheetRow[];
  callUs?: string | null;
  printedOn: string;
}

// @page margin 0 makes Chrome and Safari drop their own header/footer (date, "about:blank", page
// count); the body padding is the real margin.
export const APPOINTMENT_SHEET_CSS = `
*{box-sizing:border-box}
@page{size:letter;margin:0}
html,body{margin:0;background:#fff;color:#000}
body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:12px;line-height:1.4;padding:16mm 18mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-variant-ligatures:none}
.num,.time,.date-long{font-variant-numeric:tabular-nums}
header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-bottom:14px;border-bottom:1.5px solid #000}
.logo{height:22mm;width:auto}
.center{text-align:right}
.center-name{font-size:15px;font-weight:700;letter-spacing:.3px}
.center-line{margin-top:2px;color:#333}
.patient{margin:22px 0 16px}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#555}
.patient-name{font-size:22px;font-weight:700;margin-top:4px}
.record{margin-top:2px;color:#555}
ol{list-style:none;margin:0;padding:0;border-top:1px solid #000}
li.day{display:flex;align-items:flex-start;gap:16px;padding:12px 0;border-bottom:1px solid #bbb;break-inside:avoid;page-break-inside:avoid}
.tile{width:17mm;flex:none;border:1.5px solid #000;border-radius:6px;text-align:center;padding:4px 0 5px;display:flex;flex-direction:column}
.tile .wd,.tile .mo{font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase}
.tile .dn{font-size:22px;font-weight:700;line-height:1.1}
.entries{flex:1;min-width:0}
.date-long{font-size:11px;color:#333;margin-bottom:2px}
.appt{display:flex;align-items:baseline;gap:16px;padding:3px 0}
.appt+.appt{border-top:1px dotted #bbb;padding-top:6px;margin-top:3px}
.time{width:22mm;flex:none;font-size:20px;font-weight:700}
.what{flex:1;min-width:0}
.service{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
.doctor{margin-top:2px;color:#333}
.moved{margin-top:2px;font-size:10px;color:#555}
.call-us{margin-top:22px;padding:10px 14px;border:1px solid #000;border-radius:6px;font-size:12px;font-weight:600;break-inside:avoid}
footer{margin-top:18px;font-size:9px;color:#666}
`;

const div = (cls: string, text: string | null | undefined) => (text ? `<div class="${cls}">${escapeHtml(text)}</div>` : "");

function apptHtml(r: AppointmentSheetRow): string {
  const what = `<div class="what">${div("service", r.service)}${div("doctor", r.doctor)}${div("moved", r.movedFrom)}</div>`;
  return `<div class="appt"><div class="time">${escapeHtml(r.time)}</div>${what}</div>`;
}

/** One block per day: the date tile and long date once, then each appointment of that day. */
function dayHtml(rows: AppointmentSheetRow[]): string {
  const r = rows[0];
  const tile = `<div class="tile num"><span class="wd">${escapeHtml(r.weekday)}</span><span class="dn">${escapeHtml(r.day)}</span><span class="mo">${escapeHtml(r.month)}</span></div>`;
  return `<li class="day">${tile}<div class="entries">${div("date-long", r.dateLong)}${rows.map(apptHtml).join("")}</div></li>`;
}

/** Consecutive rows of the same day, together (the rows arrive sorted by day and time). */
function byDay(rows: AppointmentSheetRow[]): AppointmentSheetRow[][] {
  const days: AppointmentSheetRow[][] = [];
  for (const r of rows) {
    const last = days[days.length - 1];
    if (last && last[0].dateLong === r.dateLong) last.push(r);
    else days.push([r]);
  }
  return days;
}

/** A complete HTML document for its own print window. */
export function buildAppointmentSheetHtml(p: AppointmentSheetInput): string {
  const header = `<header><img class="logo" src="${escapeHtml(p.logoUrl)}" alt=""><div class="center">${div("center-name", p.center.name)}${div("center-line", p.center.address)}${div("center-line", p.center.phone)}</div></header>`;
  const patient = `<section class="patient">${div("eyebrow", p.heading)}${div("patient-name", p.patientName)}${div("record", p.record)}</section>`;
  const list = `<ol>${byDay(p.rows).map(dayHtml).join("")}</ol>`;
  const body = `${header}${patient}${list}${div("call-us", p.callUs)}<footer>${escapeHtml(p.printedOn)}</footer>`;
  return `<!doctype html><html lang="${escapeHtml(p.lang)}"><head><meta charset="utf-8"><title>${escapeHtml(p.center.name)}</title><style>${APPOINTMENT_SHEET_CSS}</style></head><body>${body}</body></html>`;
}
