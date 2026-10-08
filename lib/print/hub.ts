import type { Recibo } from "@/lib/factura/build-recibo";

// Hub de impresión ESC/POS — RESPALDO del camino normal (navegador + window.print()), que sigue
// siendo el default y no cambia en nada. Este camino existe para cuando ese falla: manda los bytes
// del recibo DIRECTO a la cola sin filtro del servidor (sin pasar por ningún driver de impresora ni
// por el diálogo del navegador), así que funciona igual en cualquier navegador. Ver
// docs/specs/recibo-termico-causa-raiz-y-arreglo.md.
//
// CADA CENTRO tiene su propia impresora compartida y, por lo tanto, su propio hub — no hay una URL
// fija aquí a propósito: el llamador resuelve la URL del centro de ESTA factura (capa `centro` de
// preferences, clave `impresionHub.url`) y la pasa. Mandar un trabajo al hub equivocado imprimiría en
// la oficina equivocada, así que esta función nunca adivina ni cae a un default.

const ESC = 0x1b;
const GS = 0x1d;

const MAPA_ASCII: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
  Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U", Ñ: "N",
  "¿": "?", "¡": "!", "—": "-", "–": "-", "“": '"', "”": '"', "’": "'",
};
function aAscii(s: string): number[] {
  const out: number[] = [];
  for (const ch of s ?? "") {
    const rep = MAPA_ASCII[ch] ?? ch;
    for (const c of rep) {
      const code = c.charCodeAt(0);
      out.push(code >= 32 && code <= 126 ? code : 63);
    }
  }
  return out;
}

const money = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;

// Generador de texto plano ESC/POS a partir del MISMO modelo `Recibo` que pinta <ReciboTermico> en
// pantalla — no es pixel-perfect (es texto a 48 columnas, sin tablas), pero trae todo lo esencial:
// empresa, paciente, líneas con importe, totales, pagos y pie. Columnas = 48 (80mm).
export function reciboComoTexto(r: Recibo): Uint8Array<ArrayBuffer> {
  const bytes: number[] = [];
  const raw = (b: number[]) => bytes.push(...b);
  const linea = (s = "") => { bytes.push(...aAscii(s)); bytes.push(0x0a); };
  const centrado = () => raw([ESC, 0x61, 0x01]);
  const izquierda = () => raw([ESC, 0x61, 0x00]);
  const negritaOn = () => raw([ESC, 0x45, 1]);
  const negritaOff = () => raw([ESC, 0x45, 0]);
  const col2 = (a: string, b: string, ancho = 48) => {
    const esp = Math.max(1, ancho - a.length - b.length);
    linea(a + " ".repeat(esp) + b);
  };

  raw([ESC, 0x40]); // init
  centrado();
  const emp = r.empresa;
  if (emp?.legalName) { negritaOn(); linea(emp.legalName); negritaOff(); }
  if (emp?.tradeName) linea(emp.tradeName);
  if (emp?.sucursal) linea(emp.sucursal);
  if (emp?.address) emp.address.split("\n").forEach((l) => linea(l));
  if (emp?.phone) linea(emp.phone);
  if (emp?.taxRegistration) linea(`${emp.taxRegistrationLabel ?? "MN"}: ${emp.taxRegistration}`);
  izquierda();
  linea("-".repeat(48));
  const titulo = r.tipoDocumento === "devolucion" ? "Devolucion" : r.tipoDocumento === "presupuesto" ? "Presupuesto" : "Factura";
  negritaOn(); linea(`${titulo} #${r.numeroDisplay}`); negritaOff();
  if (r.paciente.nombre) linea(r.paciente.nombre);
  if (r.paciente.record) linea(`Record # ${r.paciente.record}`);
  linea("-".repeat(48));
  for (const it of r.items) {
    linea(it.descripcion);
    col2(`${it.cantidad} x ${money(it.precioUnitario)}`, money(it.total));
    if (it.multiplicadores) {
      const mult = Object.entries(it.multiplicadores).map(([k, v]) => `${v} ${k}`).join(" x ");
      linea(`  (${mult})`);
    }
  }
  linea("-".repeat(48));
  col2("SubTotal", money(r.subtotal));
  if (r.descuento > 0) col2("Descuento", "-" + money(r.descuento));
  for (const imp of r.impuestos) col2(imp.nombre, money(imp.monto));
  if (r.envio > 0) col2("Envio", money(r.envio));
  negritaOn(); col2("Total", money(r.total)); negritaOff();
  col2("Total pagado", money(r.montoAbonado));
  if (r.saldo > 0) col2("Balance", money(r.saldo));
  linea("-".repeat(48));
  for (const p of r.pagos) col2(p.formaPagoNombre, money(p.monto));
  if (r.atendidoPor) linea(`Atendido por: ${r.atendidoPor}`);
  linea("-".repeat(48));
  centrado();
  linea("RESPALDO - via hub ESC/POS");
  linea("¡Gracias por su visita!");
  izquierda();
  linea("");
  linea("");
  linea("");
  linea("");
  linea("");
  linea("");
  linea("");
  linea("");
  raw([GS, 0x56, 0x00]); // corte
  return Uint8Array.from(bytes);
}

// Manda los bytes al hub del centro dueño de esta factura. `hubUrl` viene YA resuelto por el llamador
// (capa `centro` de preferences) — vacío/ausente lanza de una vez, antes de intentar ningún fetch, para
// que nunca se mande en silencio al hub de otro centro. Lanza también si el hub responde mal (el
// llamador decide el mensaje/`toast`).
export async function imprimirPorHub(r: Recibo, hubUrl: string | undefined): Promise<void> {
  if (!hubUrl) throw new Error("sin hub de respaldo configurado para este centro");
  const bytes = reciboComoTexto(r);
  const res = await fetch(hubUrl, { method: "POST", body: new Blob([bytes]) });
  if (!res.ok) throw new Error(`hub respondio ${res.status}`);
}
