import { test } from "node:test";
import assert from "node:assert/strict";

import { buildReportHtml, escapeHtml, reportFileName, REPORT_PRINT_CSS } from "./print-document.ts";

test("escapeHtml: the five specials", () => {
  assert.equal(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;");
});

test("buildReportHtml: letterhead escaped, body kept as given, footer optional", () => {
  const html = buildReportHtml({ title: "Kardex <diario>", subtitle: "Caguas · 1–18 nov", bodyHtml: "<table><tr><td>133</td></tr></table>" });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>Kardex &lt;diario&gt;<\/title>/);
  assert.match(html, /<p>Caguas · 1–18 nov<\/p>/);
  assert.match(html, /<td>133<\/td>/);
  assert.doesNotMatch(html, /report-foot">/);
  assert.match(buildReportHtml({ title: "t", bodyHtml: "", footer: "Impreso por x" }), /<footer class="report-foot">Impreso por x<\/footer>/);
});

test("reportFileName: accents, symbols and spaces out", () => {
  assert.equal(reportFileName("Kardex diario", "VITAMINA C (25 g)", "2026-11-01"), "kardex-diario-vitamina-c-25-g-2026-11-01");
  assert.equal(reportFileName("Recepción · Bayamón"), "recepcion-bayamon");
});

test("buildReportHtml: the logo goes in the letterhead when given", () => {
  assert.match(buildReportHtml({ title: "t", bodyHtml: "", logoUrl: "https://x/img/logo_cmr.png" }), /<header class="report-head"><img src="https:\/\/x\/img\/logo_cmr.png" alt="">/);
  assert.doesNotMatch(buildReportHtml({ title: "t", bodyHtml: "" }), /<img/);
});

test("a print-only section is shown in print and starts a new page", () => {
  assert.match(REPORT_PRINT_CSS, /\.print-only\{display:block!important\}/);
  assert.match(REPORT_PRINT_CSS, /\.print-break\{break-before:page;page-break-before:always\}/);
});
