import type { Recibo } from "@/lib/factura/build-recibo";

// Backup ESC/POS print path — a fallback for the normal one (browser + window.print()), which stays
// the default. It sends the receipt as raw ESC/POS bytes to the print hub, which relays them to a
// filter-free CUPS queue: no printer driver, no browser dialog, so it works the same in every browser.
// The request URL (hub + destination printer) is resolved per center by buildHubRequestUrl
// (lib/print/hub-target.ts); this module never picks a destination itself.
// See docs/specs/recibo-termico-causa-raiz-y-arreglo.md.

const ESC = 0x1b;
const GS = 0x1d;
const COLUMNS = 48; // 80mm roll

// Printed labels come from the same `receipt` i18n namespace the on-screen receipt uses.
export interface ReceiptLabels {
  invoice: string;
  returnDoc: string;
  budgetDoc: string;
  record: string;
  subtotal: string;
  discount: string;
  shipping: string;
  total: string;
  paid: string;
  balance: string;
  attendedBy: string;
  thanks: string;
  backupFooter: string;
}

const ASCII_MAP: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
  Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U", Ñ: "N",
  "¿": "?", "¡": "!", "—": "-", "–": "-", "“": '"', "”": '"', "’": "'",
};

// ESC/POS printers do not render UTF-8 reliably: transliterate to plain ASCII, "?" for the rest.
function toAscii(s: string): number[] {
  const out: number[] = [];
  for (const ch of s ?? "") {
    const rep = ASCII_MAP[ch] ?? ch;
    for (const c of rep) {
      const code = c.charCodeAt(0);
      out.push(code >= 32 && code <= 126 ? code : 63);
    }
  }
  return out;
}

const money = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;

function escPosWriter() {
  const bytes: number[] = [];
  const raw = (b: number[]) => bytes.push(...b);
  const line = (s = "") => { bytes.push(...toAscii(s)); bytes.push(0x0a); };
  return {
    raw,
    line,
    init: () => raw([ESC, 0x40]),
    center: () => raw([ESC, 0x61, 0x01]),
    left: () => raw([ESC, 0x61, 0x00]),
    bold: (on: boolean) => raw([ESC, 0x45, on ? 1 : 0]),
    twoColumns: (a: string, b: string) => line(a + " ".repeat(Math.max(1, COLUMNS - a.length - b.length)) + b),
    rule: () => line("-".repeat(COLUMNS)),
    feedAndCut: () => { for (let i = 0; i < 8; i++) line(""); raw([GS, 0x56, 0x00]); },
    bytes: () => Uint8Array.from(bytes),
  };
}

// Plain-text ESC/POS from the SAME `Recibo` model <ReciboTermico> renders — not pixel-perfect (48
// columns, no tables) but carries everything essential: company, patient, lines, totals, payments.
export function receiptToEscPos(r: Recibo, labels: ReceiptLabels): Uint8Array<ArrayBuffer> {
  const w = escPosWriter();
  w.init();
  w.center();
  const company = r.empresa;
  if (company?.legalName) { w.bold(true); w.line(company.legalName); w.bold(false); }
  if (company?.tradeName) w.line(company.tradeName);
  if (company?.sucursal) w.line(company.sucursal);
  if (company?.address) company.address.split("\n").forEach((l) => w.line(l));
  if (company?.phone) w.line(company.phone);
  if (company?.taxRegistration) w.line(`${company.taxRegistrationLabel ?? "MN"}: ${company.taxRegistration}`);
  w.left();
  w.rule();
  const title =
    r.tipoDocumento === "devolucion" ? labels.returnDoc : r.tipoDocumento === "presupuesto" ? labels.budgetDoc : labels.invoice;
  w.bold(true); w.line(`${title} #${r.numeroDisplay}`); w.bold(false);
  if (r.paciente.nombre) w.line(r.paciente.nombre);
  if (r.paciente.record) w.line(`${labels.record} # ${r.paciente.record}`);
  w.rule();
  for (const it of r.items) {
    w.line(it.descripcion);
    w.twoColumns(`${it.cantidad} x ${money(it.precioUnitario)}`, money(it.total));
    if (it.multiplicadores) {
      const mult = Object.entries(it.multiplicadores).map(([k, v]) => `${v} ${k}`).join(" x ");
      w.line(`  (${mult})`);
    }
  }
  w.rule();
  w.twoColumns(labels.subtotal, money(r.subtotal));
  if (r.descuento > 0) w.twoColumns(labels.discount, "-" + money(r.descuento));
  for (const tax of r.impuestos) w.twoColumns(tax.nombre, money(tax.monto));
  if (r.envio > 0) w.twoColumns(labels.shipping, money(r.envio));
  w.bold(true); w.twoColumns(labels.total, money(r.total)); w.bold(false);
  w.twoColumns(labels.paid, money(r.montoAbonado));
  if (r.saldo > 0) w.twoColumns(labels.balance, money(r.saldo));
  w.rule();
  for (const p of r.pagos) w.twoColumns(p.formaPagoNombre, money(p.monto));
  if (r.atendidoPor) w.line(`${labels.attendedBy}: ${r.atendidoPor}`);
  w.rule();
  w.center();
  w.line(labels.backupFooter);
  w.line(labels.thanks);
  w.left();
  w.feedAndCut();
  return w.bytes();
}

// A short ticket to check a center's hub + printer settings from the configuration screen.
export function testTicketToEscPos(lines: string[]): Uint8Array<ArrayBuffer> {
  const w = escPosWriter();
  w.init();
  w.center();
  w.bold(true);
  lines.forEach((l) => w.line(l));
  w.bold(false);
  w.left();
  w.feedAndCut();
  return w.bytes();
}

// POSTs the bytes to an already-resolved hub request URL. Throws with the hub's own message when it
// refuses (bad destination, printer unreachable) so the caller can show it as is.
export async function sendToHub(requestUrl: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const res = await fetch(requestUrl, { method: "POST", body: new Blob([bytes]) });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).trim();
    throw new Error(detail ? `hub ${res.status}: ${detail}` : `hub ${res.status}`);
  }
}
