import type { Recibo } from "../factura/build-recibo.ts";
import {
  hasMultipliers,
  multipliersText,
  receiptDateParts,
  receiptFooter,
  receiptMoney as money,
  receiptTitleKey,
} from "../factura/receipt-format.ts";
import { EscPosWriter } from "./escpos.ts";

// Translations the ticket needs, resolved by the caller from next-intl (same keys as <ReciboTermico>).
export interface ReceiptText {
  t: (key: string, values?: Record<string, string | number>) => string; // namespace `receipt`
  multiplierLabel: (key: string) => string; // fac.col.<key>, fallback the key
  paymentLabel: (p: Recibo["pagos"][number]) => string; // formasPago.<clave>, fallback the name
}

export const RECEIPT_LOGO_MAX_HEIGHT_MM = 18;

// The ESC/POS twin of components/facturacion/recibo-termico.tsx: same blocks, same order, same
// labels and formatting, block by block. Keep the two in step — a change to one is a change to both.
// `logo` is the already rasterized logo (lib/print/escpos-image.ts) or null to print without it.
export function receiptToEscPos(r: Recibo, text: ReceiptText, logo: Uint8Array | null = null): Uint8Array<ArrayBuffer> {
  const { t } = text;
  const w = new EscPosWriter().init();
  const { fecha, hora } = receiptDateParts(r.fecha);
  const multText = (m: Record<string, number>) => multipliersText(m, text.multiplierLabel);
  const emp = r.empresa;

  w.feedMm(6); // air on top, like the 6mm spacer of the screen receipt

  if (r.anulada) {
    w.align("center").bold(true).solid().doubleSize(true).line(t("void")).doubleSize(false).solid().bold(false);
  }

  // Header: logo + company/branch.
  w.align("center");
  if (logo) w.raw(logo).line();
  if (emp?.legalName) w.bold(true).wrapped(emp.legalName.toUpperCase()).bold(false);
  if (emp?.tradeName) w.wrapped(emp.tradeName);
  if (emp?.sucursal) w.wrapped(emp.sucursal);
  if (emp?.address) w.wrapped(emp.address);
  if (emp?.phone) w.wrapped(emp.phone);
  if (emp?.email) w.wrapped(emp.email);
  if (emp?.taxRegistration) {
    w.wrapped(`${emp.taxRegistrationLabel ? `${emp.taxRegistrationLabel}: ` : ""}${emp.taxRegistration}`);
  }
  w.align("left").dashed();

  // Document title (bold) + date (normal) on one row.
  const title = `${t(receiptTitleKey(r))} #${r.numeroDisplay}`;
  const pad = w.columns - title.length - fecha.length;
  if (pad >= 1) w.bold(true).text(title).bold(false).line(" ".repeat(pad) + fecha);
  else w.bold(true).wrapped(title).bold(false).line(" ".repeat(Math.max(0, w.columns - fecha.length)) + fecha);
  w.dashed();

  // Patient — bilingual caption by legal requirement (same as the legacy receipt).
  w.bold(true).wrapped(t("patientLabelEn")).bold(false);
  w.wrapped(t("patientLabelEs"));
  w.bold(true).wrapped((r.paciente.nombre || "—").toUpperCase()).bold(false);
  if (r.paciente.record) w.wrapped(`${t("record")} # ${r.paciente.record}`);
  if (r.paciente.docId) w.wrapped(`ID ${r.paciente.docId}`);
  w.dashed();

  // Lines.
  for (const it of r.items) {
    w.wrapped(it.descripcion.toUpperCase());
    const left =
      `${it.cantidad}` +
      (hasMultipliers(it) ? ` (${multText(it.multiplicadores!)})` : "") +
      ` x ${money(it.precioUnitario)}` +
      (it.descuento > 0 ? ` −\u00a0${money(it.descuento)}` : ""); // the minus stays with its amount
    w.columnsRow(left, money(it.total));
    if (it.componentes && it.componentes.length > 0) {
      const head = `${t("includes")}:` + (it.protocoloVisitas ? ` ${t("protocolVisits", { n: it.protocoloVisitas })}` : "");
      w.wrapped(head, 3);
      for (const c of it.componentes) {
        const label = `${c.cantidad} · ${c.descripcion}`;
        if (c.precio != null) w.columnsRow(label, money(c.precio), 3);
        else w.wrapped(label, 3);
        if (c.nota) w.wrapped(c.nota, 6);
      }
    }
    w.feedMm(1); // the small gap between items on screen
  }
  w.dashed();

  // Totals.
  w.columnsRow(t("subtotal"), money(r.subtotal));
  if (r.descuento > 0) w.columnsRow(t("discount"), `− ${money(r.descuento)}`);
  if (r.impuestos.length > 0) {
    for (const im of r.impuestos) {
      w.columnsRow((im.nombre || t("tax")) + (im.tasa != null ? ` (${im.tasa}%)` : ""), money(im.monto));
    }
  } else if (r.impuesto > 0) {
    w.columnsRow(t("tax"), money(r.impuesto));
  }
  if (r.envio > 0) w.columnsRow(t("shipping"), money(r.envio));
  w.solid();
  w.bold(true).columnsRow(t("total"), money(r.total)).bold(false);
  if (r.montoAbonado > 0) w.columnsRow(t("paid"), money(r.montoAbonado));
  if (r.saldo > 0) w.bold(true).columnsRow(t("balance"), money(r.saldo)).bold(false);

  // Payments.
  if (r.pagos.length > 0) {
    w.dashed();
    for (const p of r.pagos) w.columnsRow(text.paymentLabel(p) + (p.referencia ? ` ${p.referencia}` : ""), money(p.monto));
  }

  if (r.atendidoPor) w.dashed().wrapped(`${t("attendedBy")}: ${r.atendidoPor}`);

  // Legend of therapies with multipliers (laser: days × areas), one per therapy.
  const withMultipliers = r.items.filter(hasMultipliers);
  if (withMultipliers.length > 0) {
    w.dashed();
    for (const it of withMultipliers) w.wrapped(`* ${it.descripcion} — ${multText(it.multiplicadores!)}`);
  }

  // Footer.
  w.dashed().align("center");
  w.wrapped(t("thanks"));
  const footer = receiptFooter(r);
  if (footer) w.wrapped(footer);
  if (emp?.website) w.wrapped(emp.website);
  if (hora) w.line(`${fecha} ${hora}`);
  w.align("left");

  return w.cut().toBytes();
}
