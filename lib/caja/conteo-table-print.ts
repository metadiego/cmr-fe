import { money } from "./totales.ts";

// Una línea de conteo, normalizada: las dos fuentes del BE la nombran distinto (conteoEfectivo.lines:
// denominationId/value/quantity/amount en inglés; divisionCounts.*.lines: denominacionId/valor/
// cantidad/monto en español — BE #566, handoff .personal/handoff-cuadre-uno-o-dos-conteos.md). El
// llamador normaliza a esta forma ANTES de pedir la tabla, para no repetir el mapeo en cada sitio.
export type ConteoLineaSimple = { key: string; quantity: number; value: number; amount: number };

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// Una tabla de conteo (título + cantidad·valor·monto de mayor a menor + total), para la hoja impresa.
// `total: null` = sin conteo todavía. Reusada tal cual para el conteo único Y para cada panel de
// división en modo `split` — misma forma, una sola vez escrita.
export function conteoTableHtml(opts: {
  title: string;
  lines: ConteoLineaSimple[];
  total: number | null;
  labels: { colCantidad: string; colValor: string; colMonto: string; conteoTotal: string; sinConteo: string };
}): string {
  const { title, lines, total, labels } = opts;
  const sorted = [...lines].sort((a, b) => b.value - a.value);
  const body =
    total == null
      ? `<p class="dim">${esc(labels.sinConteo)}</p>`
      : `<table class="conteo"><thead><tr><th class="r">${esc(labels.colCantidad)}</th><th class="r">${esc(labels.colValor)}</th><th class="r">${esc(labels.colMonto)}</th></tr></thead>
         <tbody>${
           sorted.length
             ? sorted
                 .map((l) => `<tr><td class="r mono">${esc(l.quantity)}</td><td class="r mono dim">${esc(money(l.value))}</td><td class="r mono">${esc(money(l.amount))}</td></tr>`)
                 .join("")
             : `<tr><td colspan="3" class="dim">${esc(labels.sinConteo)}</td></tr>`
         }</tbody>
         <tfoot><tr class="tot"><td colspan="2" class="r dim">${esc(labels.conteoTotal)}</td><td class="r mono">${esc(money(total))}</td></tr></tfoot></table>`;
  return `<h2>${esc(title)}</h2>${body}`;
}
