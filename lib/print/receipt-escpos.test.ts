// The ESC/POS backup ticket must carry EXACTLY what the on-screen receipt preview shows — same blocks,
// order, labels, amounts and bold — built from a real preview (quote for RAMOS HUECA, LILLIAM, CMR
// Bayamon, 2026-10-08). Only line breaks differ: the ticket keeps the printer's own font at 48
// columns (the owner tells hub tickets apart by that typeface), the screen wraps at ~38.
import test from "node:test";
import assert from "node:assert/strict";

import { receiptToEscPos, type ReceiptText } from "./receipt-escpos.ts";
import { encodePc850, twoColumns, wrap } from "./escpos.ts";
import { rgbaToEscPosRaster, logoDots } from "./escpos-image.ts";
import type { Recibo } from "../factura/build-recibo.ts";

// Reverse PC850 for the characters used here, and a decoder that drops ESC/POS commands.
const REVERSE = new Map<number, string>();
for (const ch of "áéíóúñÑÁÉÍÓÚüÜ¿¡×·─") REVERSE.set(encodePc850(ch)[0], ch);

function decode(bytes: Uint8Array): { lines: string[]; bold: Set<number>; fontB: Set<number>; cut: boolean; raster: boolean } {
  const lines: string[] = [];
  const bold = new Set<number>();
  const fontB = new Set<number>();
  let cur = "";
  let isBold = false;
  let isB = false;
  let cut = false;
  let raster = false;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x1b) {
      const cmd = bytes[i + 1];
      if (cmd === 0x40) { i += 1; continue; }
      if (cmd === 0x45) isBold = bytes[i + 2] === 1;
      if (cmd === 0x4d) isB = bytes[i + 2] === 1;
      i += 2;
      continue;
    }
    if (b === 0x1d) {
      const cmd = bytes[i + 1];
      if (cmd === 0x56) { cut = true; i += 3; continue; }
      if (cmd === 0x76) {
        raster = true;
        const w = bytes[i + 4] | (bytes[i + 5] << 8);
        const h = bytes[i + 6] | (bytes[i + 7] << 8);
        i += 7 + w * h;
        continue;
      }
      i += 2;
      continue;
    }
    if (b === 0x0a) {
      if (isBold) bold.add(lines.length);
      if (isB) fontB.add(lines.length);
      lines.push(cur);
      cur = "";
      continue;
    }
    if (isBold) bold.add(lines.length);
    cur += b < 0x80 ? String.fromCharCode(b) : (REVERSE.get(b) ?? "?");
  }
  return { lines, bold, fontB, cut, raster };
}

const ES: Record<string, string> = {
  void: "ANULADA", invoice: "Factura", returnDoc: "Devolución", budgetDoc: "PRESUPUESTO",
  patientLabelEn: "Patient or Responsible Party", patientLabelEs: "Paciente o responsable", record: "Record",
  subtotal: "SubTotal", discount: "Descuento", tax: "Impuesto", shipping: "Envío", total: "Total",
  paid: "Total pagado", balance: "Saldo", attendedBy: "Atendido por", thanks: "¡Gracias por su visita!",
  includes: "Incluye", protocolVisits: "Protocolo de {n} visitas",
};
const TEXT: ReceiptText = {
  t: (k, v) => (ES[k] ?? k).replace("{n}", String(v?.n ?? "")),
  multiplierLabel: (k) => ({ dias: "Días", areas: "Áreas" })[k] ?? k,
  paymentLabel: (p) => (p.clave === "efectivo" ? "Efectivo" : p.formaPagoNombre),
};

const FOOTER =
  "Thanks for your visit! | ¡Gracias por su visita!\nIMPORTANT: This quote is subject to change without notice. If using insurance or a company, you must deposit the uncovered difference per the authorization letter. | IMPORTANTE: Este presupuesto está sujeto a cambio sin previo aviso. En caso de utilizar seguro o compañía debe depositar la diferencia no cubierta en la carta aval.";

const QUOTE: Recibo = {
  empresa: {
    legalName: "MEDICINA SISTEMICA LLC", tradeName: null, sucursal: "CMR Bayamon",
    address: "Av. Dr. Veve # 51 Esq. calle Marti\nBayamon PR", phone: "787-780-7575", email: null,
    taxRegistration: "0647913-0012", taxRegistrationLabel: "MN", invoiceFooter: null, quoteFooter: FOOTER,
    website: "centrodemedicinaregenerativa.com", logoUrl: null,
  },
  logoUrl: null,
  tipoDocumento: "presupuesto",
  numeroDisplay: "—",
  fecha: "2026-10-05",
  estado: "borrador",
  anulada: false,
  paciente: { nombre: "RAMOS HUECA, LILLIAM", record: "103027", docId: null },
  items: [
    { cantidad: 60, descripcion: "Terapia del dolor (1 sesión) MLS", precioUnitario: 70, descuento: 1339.13, total: 2860.87, multiplicadores: { dias: 1, areas: 5 } },
    { cantidad: 24, descripcion: "TERAPIA DEL DOLOR FULL HILT", precioUnitario: 150, descuento: 1147.83, total: 2452.17, multiplicadores: { dias: 1, areas: 2 } },
    { cantidad: 12, descripcion: "TERAPIA MAG - PEMF", precioUnitario: 40, descuento: 153.04, total: 326.96, multiplicadores: { dias: 1, areas: 1 } },
  ],
  subtotal: 8280, descuento: 2640, impuesto: 0, impuestos: [], envio: 0, total: 5640,
  montoAbonado: 120, saldo: 5520,
  pagos: [{ formaPagoNombre: "EFECTIVO", clave: "efectivo", monto: 120 }],
  atendidoPor: "Waldemar Ortiz",
};

const DASH = "-".repeat(48);
const SOLID = "─".repeat(48);
const row = (label: string, value: string) => label + " ".repeat(48 - label.length - value.length) + value;

test("the ticket reads line for line like the on-screen preview", () => {
  const { lines } = decode(receiptToEscPos(QUOTE, TEXT));
  assert.deepEqual(lines, [
    "MEDICINA SISTEMICA LLC",
    "CMR Bayamon",
    "Av. Dr. Veve # 51 Esq. calle Marti",
    "Bayamon PR",
    "787-780-7575",
    "MN: 0647913-0012",
    DASH,
    row("PRESUPUESTO #-", "10/05/2026"),
    DASH,
    "Patient or Responsible Party",
    "Paciente o responsable",
    "RAMOS HUECA, LILLIAM",
    "Record # 103027",
    DASH,
    "TERAPIA DEL DOLOR (1 SESIÓN) MLS",
    row("60 (1 Días × 5 Áreas) x $70.00", "$2860.87"),
    "- $1339.13",
    "TERAPIA DEL DOLOR FULL HILT",
    row("24 (1 Días × 2 Áreas) x $150.00", "$2452.17"),
    "- $1147.83",
    "TERAPIA MAG - PEMF",
    row("12 (1 Días × 1 Áreas) x $40.00 - $153.04", "$326.96"),
    DASH,
    row("SubTotal", "$8280.00"),
    row("Descuento", "- $2640.00"),
    SOLID,
    row("Total", "$5640.00"),
    row("Total pagado", "$120.00"),
    row("Saldo", "$5520.00"),
    DASH,
    row("Efectivo", "$120.00"),
    DASH,
    "Atendido por: Waldemar Ortiz",
    DASH,
    "* Terapia del dolor (1 sesión) MLS - 1 Días × 5",
    "Áreas",
    "* TERAPIA DEL DOLOR FULL HILT - 1 Días × 2 Áreas",
    "* TERAPIA MAG - PEMF - 1 Días × 1 Áreas",
    DASH,
    "¡Gracias por su visita!",
    "Thanks for your visit! | ¡Gracias por su visita!",
    "IMPORTANT: This quote is subject to change",
    "without notice. If using insurance or a company,",
    "you must deposit the uncovered difference per",
    "the authorization letter. | IMPORTANTE: Este",
    "presupuesto está sujeto a cambio sin previo",
    "aviso. En caso de utilizar seguro o compañía",
    "debe depositar la diferencia no cubierta en la",
    "carta aval.",
    "centrodemedicinaregenerativa.com",
  ]);
});

test("bold where the preview is bold; one single font (the hub's); ends with a cut", () => {
  const { lines, bold, fontB, cut } = decode(receiptToEscPos(QUOTE, TEXT));
  const at = (s: string) => lines.indexOf(s);
  for (const s of ["MEDICINA SISTEMICA LLC", "Patient or Responsible Party", "RAMOS HUECA, LILLIAM", row("Total", "$5640.00"), row("Saldo", "$5520.00")]) {
    assert.ok(bold.has(at(s)), `bold: ${s}`);
  }
  assert.ok(!bold.has(at(row("Total pagado", "$120.00"))));
  assert.equal(fontB.size, 0);
  assert.ok(cut);
});

test("issued invoice: title, time stamp, invoice footer, taxes with rate, void banner", () => {
  const r: Recibo = {
    ...QUOTE, tipoDocumento: "factura", numeroDisplay: "F-000123", estado: "emitida", anulada: true,
    fecha: "2026-10-08T14:05:09", impuestos: [{ nombre: "IVU", tasa: 11.5, monto: 10 }],
    empresa: { ...QUOTE.empresa!, invoiceFooter: "Pie de factura" },
  };
  const { lines } = decode(receiptToEscPos(r, TEXT));
  assert.equal(lines[0], SOLID);
  assert.ok(lines.includes("ANULADA"));
  assert.ok(lines.includes(row("Factura #F-000123", "10/08/2026")));
  assert.ok(lines.includes(row("IVU (11.5%)", "$10.00")));
  assert.ok(lines.includes("Pie de factura"));
  assert.ok(!lines.some((l) => l.startsWith("IMPORTANT:")));
  assert.equal(lines.at(-1), "10/08/2026 14:05:09");
});

test("kit components print indented under the line with their reference price", () => {
  const r: Recibo = {
    ...QUOTE,
    items: [{ cantidad: 1, descripcion: "Kit rodilla", precioUnitario: 500, descuento: 0, total: 500, protocoloVisitas: 3,
      componentes: [{ cantidad: 2, descripcion: "PRP", precio: 200 }, { cantidad: 1, descripcion: "Ácido hialurónico", nota: "lado izquierdo" }] }],
  };
  const { lines } = decode(receiptToEscPos(r, TEXT));
  const i = lines.indexOf("   Incluye: Protocolo de 3 visitas");
  assert.ok(i > 0);
  assert.equal(lines[i + 1], "   " + "2 · PRP" + " ".repeat(45 - "2 · PRP".length - 7) + "$200.00");
  assert.equal(lines[i + 2], "   1 · Ácido hialurónico");
  assert.equal(lines[i + 3], "      lado izquierdo");
});

test("logo raster goes first when given", () => {
  const logo = rgbaToEscPosRaster(new Uint8Array(16 * 2 * 4), 16, 2);
  const { raster } = decode(receiptToEscPos(QUOTE, TEXT, logo));
  assert.ok(raster);
});

test("wrap and twoColumns", () => {
  assert.deepEqual(wrap("a bb ccc", 4), ["a bb", "ccc"]);
  assert.deepEqual(wrap("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  assert.deepEqual(wrap("a -\u00a0$5", 4), ["a", "-\u00a0$5"]);
  assert.deepEqual(twoColumns("Total", "$1.00", 12), ["Total  $1.00"]);
  assert.deepEqual(twoColumns("aaa bbb", "$1", 6), ["aaa $1", "bbb"]);
});

test("accents print in PC850, unknown characters as ?", () => {
  assert.deepEqual(encodePc850("ñÁ"), [0xa4, 0xb5]);
  assert.deepEqual(encodePc850("−—"), [0x2d, 0x2d]);
  assert.deepEqual(encodePc850("€"), [0x3f]);
});

test("raster: black pixel sets the bit, transparent prints white; header carries the size", () => {
  // 2×1: opaque black, fully transparent black
  const out = rgbaToEscPosRaster([0, 0, 0, 255, 0, 0, 0, 0], 2, 1);
  assert.deepEqual([...out.slice(0, 8)], [0x1d, 0x76, 0x30, 0, 1, 0, 1, 0]);
  assert.equal(out[8], 0b1000_0000);
});

test("logo size follows the preview: CSS px at 96dpi, max 18mm tall on a 203dpi head", () => {
  assert.deepEqual(logoDots(100, 50, 18), { width: 211, height: 106 });
  assert.deepEqual(logoDots(1000, 500, 18), { width: 288, height: 144 });
});
