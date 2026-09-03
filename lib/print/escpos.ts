// Generador ESC/POS del recibo térmico. Independiente del navegador: son bytes crudos que se envían a
// la impresora (vía QZ Tray) igual que hace un POS. Funciona en EPSON TM (y Star/otras en modo ESC/POS).
// Transliteramos acentos a ASCII para no depender de la página de códigos de cada modelo (ñ→n, á→a…):
// más feo pero JAMÁS sale basura. El ancho en columnas es dato (48 = 80mm Font A; 32 = 58mm).
import type { Recibo } from "@/lib/factura/build-recibo";

// Etiquetas i18n que pasa el componente (la lib se mantiene pura, sin next-intl).
export interface EscPosLabels {
  factura: string;
  presupuesto: string;
  devolucion: string;
  anulada: string;
  patientEn: string;
  patientEs: string;
  record: string;
  id: string;
  subtotal: string;
  discount: string;
  tax: string;
  shipping: string;
  total: string;
  paid: string;
  balance: string;
  includes: string;
}

const ESC = 0x1b;
const GS = 0x1d;

// Transliteración a ASCII imprimible (CP437 base). Todo lo que no mapee → '?'.
const MAP: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
  Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U", Ñ: "N",
  "¿": "?", "¡": "!", "€": "EUR", "–": "-", "—": "-", "“": '"', "”": '"', "’": "'", "°": "o",
};
function ascii(s: string): number[] {
  const out: number[] = [];
  for (const ch of s ?? "") {
    const rep = MAP[ch] ?? ch;
    for (const c of rep) {
      const code = c.charCodeAt(0);
      out.push(code >= 32 && code <= 126 ? code : 63); // 63 = '?'
    }
  }
  return out;
}

const money = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;

// Constructor mínimo de un flujo ESC/POS.
class EscPos {
  private buf: number[] = [];
  constructor(private cols: number) {}
  raw(...b: number[]) { this.buf.push(...b); return this; }
  init() { return this.raw(ESC, 0x40); } // ESC @
  align(a: 0 | 1 | 2) { return this.raw(ESC, 0x61, a); } // 0 izq,1 centro,2 der
  bold(on: boolean) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  size(double: boolean) { return this.raw(GS, 0x21, double ? 0x11 : 0x00); } // doble alto+ancho
  text(s: string) { this.buf.push(...ascii(s)); return this; }
  ln(s = "") { return this.text(s).raw(0x0a); }
  // Fila etiqueta ⟷ valor a lo ancho de la columna (valor pegado a la derecha).
  lr(left: string, right: string) {
    const l = (left ?? "").slice(0, Math.max(0, this.cols - right.length - 1));
    const gap = Math.max(1, this.cols - l.length - right.length);
    return this.ln(l + " ".repeat(gap) + right);
  }
  dashed() { return this.ln("-".repeat(this.cols)); }
  // Envuelve un texto largo en varias líneas de `cols` (para dirección/pie).
  wrap(s: string) {
    const words = (s ?? "").split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      if ((line + (line ? " " : "") + w).length > this.cols) { if (line) this.ln(line); line = w; }
      else line += (line ? " " : "") + w;
    }
    if (line) this.ln(line);
    return this;
  }
  feedCut() { return this.raw(0x0a, 0x0a, 0x0a, 0x0a).raw(GS, 0x56, 0x42, 0x00); } // feed + corte parcial
  bytes(): Uint8Array { return new Uint8Array(this.buf); }
}

// Recibo → bytes ESC/POS. `cols` por defecto 48 (80mm). El logo (imagen) se omite en ESC/POS v1:
// va el nombre en negrita/doble; el ráster del logo se puede sumar después.
export function reciboToEscPos(r: Recibo, labels: EscPosLabels, cols = 48): Uint8Array {
  const p = new EscPos(cols).init();
  const emp = r.empresa;

  // Encabezado centrado
  p.align(1);
  if (r.anulada) p.bold(true).ln(labels.anulada).bold(false);
  if (emp?.legalName) p.bold(true).size(true).ln(emp.legalName).size(false).bold(false);
  if (emp?.tradeName) p.ln(emp.tradeName);
  if (emp?.sucursal) p.ln(emp.sucursal);
  if (emp?.address) emp.address.split(/\r?\n/).forEach((li) => p.wrap(li));
  if (emp?.phone) p.ln(emp.phone);
  if (emp?.email) p.ln(emp.email);
  if (emp?.taxRegistration) p.ln(`${emp.taxRegistrationLabel ? emp.taxRegistrationLabel + ": " : ""}${emp.taxRegistration}`);

  p.align(0).dashed();
  const tipo =
    r.tipoDocumento === "devolucion" ? labels.devolucion
    : r.tipoDocumento === "presupuesto" ? labels.presupuesto
    : labels.factura;
  p.bold(true).lr(`${tipo} #${r.numeroDisplay || "-"}`, r.fecha || "").bold(false);
  p.dashed();

  // Paciente
  p.bold(true).ln(labels.patientEn).bold(false).ln(labels.patientEs);
  p.bold(true).ln((r.paciente.nombre || "-").toUpperCase()).bold(false);
  if (r.paciente.record) p.ln(`${labels.record} # ${r.paciente.record}`);
  if (r.paciente.docId) p.ln(`${labels.id} ${r.paciente.docId}`);
  p.dashed();

  // Líneas
  for (const it of r.items) {
    p.ln(it.descripcion.toUpperCase());
    const izq = `${it.cantidad} x ${money(it.precioUnitario)}${it.descuento > 0 ? ` - ${money(it.descuento)}` : ""}`;
    p.lr(izq, money(it.total));
    if (it.componentes?.length) {
      p.ln(`  ${labels.includes}:`);
      for (const c of it.componentes) p.ln(`  ${c.cantidad} ${c.descripcion}`.slice(0, cols));
    }
  }
  p.dashed();

  // Totales
  p.lr(labels.subtotal, money(r.subtotal));
  if (r.descuento > 0) p.lr(labels.discount, `- ${money(r.descuento)}`);
  if (r.impuestos.length) r.impuestos.forEach((im) => p.lr(`${im.nombre || labels.tax}${im.tasa != null ? ` (${im.tasa}%)` : ""}`, money(im.monto)));
  else if (r.impuesto > 0) p.lr(labels.tax, money(r.impuesto));
  if (r.envio > 0) p.lr(labels.shipping, money(r.envio));
  p.bold(true).lr(labels.total, money(r.total)).bold(false);
  if (r.montoAbonado > 0) p.lr(labels.paid, money(r.montoAbonado));
  if (r.saldo > 0.005) p.lr(labels.balance, money(r.saldo));

  // Pagos
  if (r.pagos.length) { p.dashed(); r.pagos.forEach((pg) => p.lr(pg.formaPagoNombre || "-", money(pg.monto))); }

  // Pie (pieFactura / piePresupuesto ya viene en empresa; el recibo lo trae en el pie legacy)
  const pie = r.tipoDocumento === "presupuesto" ? emp?.quoteFooter : emp?.invoiceFooter;
  if (pie) { p.dashed().align(1); pie.split(/\r?\n|\s\|\s/).forEach((li) => p.wrap(li.trim())); p.align(0); }
  if (emp?.website) p.align(1).ln(emp.website).align(0);

  return p.feedCut().bytes();
}
