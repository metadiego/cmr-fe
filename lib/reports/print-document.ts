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
header.report-head{border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px}
header.report-head h1{font-size:16px;margin:0}
header.report-head p{margin:2px 0 0;color:#333}
table{width:100%;border-collapse:collapse;font-size:10px;margin-top:4px}
th,td{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}
th{background:#f2f2f2}
tfoot td{font-weight:700;background:#f7f7f7}
.text-right{text-align:right}.font-bold,.font-semibold{font-weight:700}
.text-xs{font-size:9px}.text-muted-foreground{color:#555}
footer.report-foot{margin-top:14px;font-size:9px;color:#555;border-top:1px solid #ccc;padding-top:4px}
`;

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

/** A complete HTML document: letterhead (title + subtitle), the report body (already-rendered HTML), footer. */
export function buildReportHtml(p: { title: string; subtitle?: string; bodyHtml: string; footer?: string }): string {
  const sub = p.subtitle ? `<p>${escapeHtml(p.subtitle)}</p>` : "";
  const foot = p.footer ? `<footer class="report-foot">${escapeHtml(p.footer)}</footer>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(p.title)}</title><style>${REPORT_PRINT_CSS}</style></head><body><header class="report-head"><h1>${escapeHtml(p.title)}</h1>${sub}</header>${p.bodyHtml}${foot}</body></html>`;
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
