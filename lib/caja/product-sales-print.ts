import { componentAmount, invoiceTotals, taxColumns, type ProductSales } from "./product-sales.ts";
import { money } from "./totales.ts";

// «Venta de productos (IVU)» on the printed cash sheet: same data as the screen section
// (components/caja/product-sales-section.tsx), as HTML for the print window of cuadre-detalle.
// Labels arrive translated; tax columns come from the data.

export type ProductSalesPrintLabels = Record<
  | "title" | "taxable" | "exempt" | "exonerated" | "taxCollected" | "taxWouldBe" | "refunds" | "net"
  | "amount" | "base" | "discount" | "taxShort" | "lines"
  | "colNumber" | "colRecord" | "colPatient" | "colBase" | "colDiscount" | "colTotal" | "colExonerated"
  | "colRefunded" | "colPayment" | "totals" | "none" | "yes" | "no"
  | "check" | "products" | "services" | "dayNet" | "squares" | "gap",
  string
>;

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function productSalesPrintHtml(ps: ProductSales, L: ProductSalesPrintLabels): string {
  const cols = taxColumns(ps);
  const invoices = ps.invoices ?? [];
  const tot = invoiceTotals(invoices, cols);
  const m = (n: number) => esc(money(n));
  const neg = (n: number) => (n > 0 ? `−${m(n)}` : m(0));

  const bucket = (label: string, b: ProductSales["taxable"], extra = "") =>
    `<tr><td>${esc(label)}</td><td class="r mono">${m(b.amount)}</td><td class="r mono">${m(b.discount)}</td><td class="r mono">${m(b.base)}</td><td class="r mono">${m(b.tax)}</td><td class="r mono">${esc(b.lines)}</td><td class="r mono">${extra}</td></tr>`;
  const taxLine = cols.map((c) => `${esc(c.name)} ${esc(c.rate)}%: ${m(componentAmount(ps.tax, c.key))}`).join(" · ");

  const rows = invoices
    .map(
      (inv) =>
        `<tr><td class="mono">${esc(inv.number || "—")}</td><td class="mono dim">${esc(inv.medicalRecordNumber || "")}</td><td>${esc(inv.patient || "—")}</td><td class="r mono">${m(inv.base)}</td><td class="r mono">${m(inv.discount)}</td>${cols
          .map((c) => `<td class="r mono">${m(componentAmount(inv.tax, c.key))}</td>`)
          .join("")}<td class="r mono">${m(inv.total)}</td><td>${esc(inv.exonerated ? L.yes : L.no)}</td><td class="r mono">${neg(inv.refunded ?? 0)}</td><td class="mono">${esc(inv.paymentMethods || "—")}</td></tr>`,
    )
    .join("");
  const span = 9 + cols.length;
  const foot = invoices.length
    ? `<tfoot><tr class="tot"><td colspan="3">${esc(L.totals.replace("{n}", String(invoices.length)))}</td><td class="r mono">${m(tot.base)}</td><td class="r mono">${m(tot.discount)}</td>${cols
        .map((c) => `<td class="r mono">${m(tot.byComponent[c.key] ?? 0)}</td>`)
        .join("")}<td class="r mono">${m(tot.total)}</td><td>${tot.exonerated}</td><td class="r mono">${neg(tot.refunded)}</td><td></td></tr></tfoot>`
    : "";

  const c = ps.check;
  const checkLine = c
    ? `<p class="${c.squares ? "" : "rojo"}"><b>${esc(L.check)}:</b> ${esc(L.products)} ${m(c.products)} + ${esc(L.services)} ${m(c.services)} = ${esc(L.dayNet)} ${m(c.dayNet)} — ${
        c.squares ? esc(L.squares) : esc(L.gap.replace("{amount}", money(c.gap)))
      }</p>`
    : "";

  return `<h2>${esc(L.title)}</h2>
    <table>
      <thead><tr><th></th><th class="r">${esc(L.amount)}</th><th class="r">${esc(L.discount)}</th><th class="r">${esc(L.base)}</th><th class="r">${esc(L.taxShort)}</th><th class="r">${esc(L.lines)}</th><th class="r">${esc(L.taxWouldBe)}</th></tr></thead>
      <tbody>
        ${bucket(L.taxable, ps.taxable)}
        ${bucket(L.exempt, ps.exempt)}
        ${bucket(L.exonerated, ps.exonerated, m(ps.exonerated.taxWouldBe?.total ?? 0))}
      </tbody>
    </table>
    <p><b>${esc(L.taxCollected)}:</b> ${m(ps.tax.total)}${taxLine ? ` (${taxLine})` : ""} · <b>${esc(L.refunds)}:</b> ${neg(ps.refunds.amount)} · <b>${esc(L.net)}:</b> ${m(ps.net)}</p>
    <table>
      <thead><tr><th>${esc(L.colNumber)}</th><th>${esc(L.colRecord)}</th><th>${esc(L.colPatient)}</th><th class="r">${esc(L.colBase)}</th><th class="r">${esc(L.colDiscount)}</th>${cols
        .map((x) => `<th class="r">${esc(x.name)}</th>`)
        .join("")}<th class="r">${esc(L.colTotal)}</th><th>${esc(L.colExonerated)}</th><th class="r">${esc(L.colRefunded)}</th><th>${esc(L.colPayment)}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="${span}" class="dim">${esc(L.none)}</td></tr>`}</tbody>
      ${foot}
    </table>
    ${checkLine}`;
}
