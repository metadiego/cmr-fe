// The ONE print document every report uses (owner, 18-nov-2026: «el mismo patrón en todo: Imprimir, CSV y
// email»). The app shell's print CSS isolates the thermal receipt and hides everything else, so a report
// printed in place came out BLANK; the report goes to its own window instead, with a letterhead, its
// tables and a footer, letter size. Pure: tested in print-document.test.ts.

export const REPORT_PRINT_CSS = `
*{box-sizing:border-box}
@page{size:letter;margin:12mm}
body{font-family:system-ui,-apple-system,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.no-print,button,[role=tablist]{display:none!important}
[hidden],[data-state=inactive][role=tabpanel]{display:none!important}
header.report-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0f3d5e;padding-bottom:8px;margin-bottom:12px}
header.report-head img{height:46px;width:auto;object-fit:contain}
header.report-head .titles{flex:1}
header.report-head h1{font-size:17px;margin:0;color:#0f3d5e;letter-spacing:.2px}
header.report-head p{margin:3px 0 0;color:#333}
table{width:100%;border-collapse:collapse;font-size:10px;margin-top:4px}
th,td{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}
th{background:#f2f2f2}
tfoot td{font-weight:700;background:#f7f7f7}
.text-right{text-align:right}.font-bold,.font-semibold{font-weight:700}
.text-xs{font-size:9px}.text-muted-foreground{color:#555}
.uppercase{text-transform:uppercase}
/* Kardex monthly subtotal row (owner, 28-nov-2026): the whole row tinted edge to edge, not just
   the month label — Tailwind's own bg-muted/border classes have no effect here (this popup only
   loads this stylesheet, never Tailwind's), so the row needs its own rule. */
.kardex-month-row td{background:#e8edf3;border-top:2px solid #0f3d5e}
/* A section added to the print on request (e.g. the kardex «Resumen gerencial»): hidden on screen with
   Tailwind's \`hidden\`, shown here. print-keep keeps it in one piece: it stays on the same sheet when it
   fits and the browser moves the whole block to the next sheet when it does not. */
.print-only{display:block!important}
.print-keep{break-inside:avoid;page-break-inside:avoid;margin-top:18px}
h2.print-section{font-size:14px;margin:0 0 8px;color:#0f3d5e}
footer.report-foot{margin-top:14px;font-size:9px;color:#555;border-top:1px solid #ccc;padding-top:4px}
`;

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

/** A complete HTML document: letterhead (title + subtitle), the report body (already-rendered HTML), footer. */
export function buildReportHtml(p: { title: string; subtitle?: string; bodyHtml: string; footer?: string; logoUrl?: string }): string {
  const sub = p.subtitle ? `<p>${escapeHtml(p.subtitle)}</p>` : "";
  const logo = p.logoUrl ? `<img src="${escapeHtml(p.logoUrl)}" alt="">` : "";
  const foot = p.footer ? `<footer class="report-foot">${escapeHtml(p.footer)}</footer>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(p.title)}</title><style>${REPORT_PRINT_CSS}</style></head><body><header class="report-head">${logo}<div class="titles"><h1>${escapeHtml(p.title)}</h1>${sub}</div></header>${p.bodyHtml}${foot}</body></html>`;
}

/** A file name safe on every OS: «Kardex diario · VITAMINA C» → «kardex-diario-vitamina-c». */
export function reportFileName(...parts: string[]): string {
  return parts
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
