import { test } from "node:test";
import assert from "node:assert/strict";

import {
  alreadySignedBy,
  figuresChanged,
  figuresOfReport,
  liveSignature,
  readSignOffStatement,
  signatureBlocks,
  signaturesPrintHtml,
  type CashSignature,
  type SignedFigures,
} from "./sign-off.ts";

const figs: SignedFigures = { dayTotal: 500, salesCash: 40, countedCash: 90, difference: 0 };
const sig = (over: Partial<CashSignature>): CashSignature => ({
  id: "s1",
  reconciliationId: "r1",
  role: "cashier",
  staffId: "u1",
  signerName: "Laesi",
  statement: "ok",
  signedAt: "2026-11-06T19:45:00.000Z",
  figures: figs,
  voidedAt: null,
  voidReason: null,
  ...over,
});

test("figuresOfReport reads the same four numbers the BE seals, rounded to cents", () => {
  assert.deepEqual(
    figuresOfReport({ detalle: { total: 500.004, efectivo: { amount: 40 } }, reconciliation: { countedCash: 90, difference: -0.001 } }),
    { dayTotal: 500, salesCash: 40, countedCash: 90, difference: -0 },
  );
  assert.deepEqual(figuresOfReport({}), { dayTotal: 0, salesCash: 0, countedCash: 0, difference: 0 });
});

test("figuresChanged: a late sale moves the day total; equal cents do not", () => {
  assert.equal(figuresChanged(figs, { ...figs }), false);
  assert.equal(figuresChanged(figs, { ...figs, dayTotal: 500.001 }), false);
  assert.equal(figuresChanged(figs, { ...figs, dayTotal: 535 }), true);
  assert.equal(figuresChanged(figs, { ...figs, difference: -5 }), true);
});

test("liveSignature skips voided ones (re-signed) and keeps the newest of the role", () => {
  const list = [
    sig({ id: "old", voidedAt: "2026-11-06T20:00:00Z", voidReason: "re-signed" }),
    sig({ id: "new", signedAt: "2026-11-06T20:00:00.000Z" }),
    sig({ id: "boss", role: "supervisor" }),
  ];
  assert.equal(liveSignature(list, "cashier")?.id, "new");
  assert.equal(liveSignature(list, "supervisor")?.id, "boss");
  assert.equal(liveSignature([sig({ voidedAt: "x" })], "cashier"), null);
});

test("alreadySignedBy reads who signed from the 409 body; other errors are not it", () => {
  assert.deepEqual(
    alreadySignedBy({ code: "CASH_SHEET_ALREADY_SIGNED", status: 409, data: { signedBy: "Ana", signedAt: "2026-11-06T19:00:00Z" } }),
    { signedBy: "Ana", signedAt: "2026-11-06T19:00:00Z" },
  );
  assert.equal(alreadySignedBy({ code: "VALIDATION_ERROR", status: 400 }), null);
  assert.equal(alreadySignedBy(null), null);
});

test("readSignOffStatement: the center's text, trimmed; blank or missing = null", () => {
  assert.equal(readSignOffStatement({ caja: { signOff: { statement: "  Todo bien. " } } }), "Todo bien.");
  assert.equal(readSignOffStatement({ caja: { signOff: { statement: "  " } } }), null);
  assert.equal(readSignOffStatement(null), null);
});

test("signatureBlocks: a cashier's sheet is Cajero + Gerente, red when the sheet moved", () => {
  const blocks = signatureBlocks({ own: [sig({})], now: { ...figs, dayTotal: 535 }, isCashierSheet: true });
  assert.deepEqual(blocks.map((b) => [b.role, b.cashierName, !!b.signature, b.changed]), [
    ["cashier", null, true, true],
    ["supervisor", null, false, false],
  ]);
});

test("signatureBlocks: consolidated/total = one block per cashier sheet (judged on ITS figures) + Gerente", () => {
  const blocks = signatureBlocks({
    own: [sig({ role: "supervisor", signerName: "Gerente G" })],
    now: { ...figs, dayTotal: 900 },
    isCashierSheet: false,
    siblings: [
      { id: "a", userId: "u1", name: "Laesi R", signatures: [sig({ reconciliationId: "a" })], now: figs },
      { id: "b", userId: "u2", name: "Sheila", signatures: [], now: null },
    ],
  });
  assert.deepEqual(blocks.map((b) => [b.key, b.cashierName, !!b.signature, b.changed]), [
    ["cashier:a", "Laesi", true, false],
    ["cashier:b", "Sheila", false, false],
    ["supervisor", null, true, true],
  ]);
  // No cashier sheets that day: still one blank «Cajero» line.
  assert.deepEqual(signatureBlocks({ own: [], now: figs, isCashierSheet: false }).map((b) => b.key), ["cashier", "supervisor"]);
});

test("signaturesPrintHtml: stamp over the line, label under it, escaped, red note when moved", () => {
  const html = signaturesPrintHtml(
    [{ label: "Cajero — <Ana>", line: "Aceptado por Ana · 11/06/2026, 3:45 PM", warning: "Firmado con otras cifras" }, { label: "Gerente" }],
    "Confirmo.",
  );
  assert.match(html, /firma-texto">Confirmo\./);
  assert.match(html, /Aceptado por Ana · 11\/06\/2026, 3:45 PM<div class="rojo">Firmado con otras cifras<\/div>/);
  assert.match(html, /Cajero — &lt;Ana&gt;/);
  assert.match(html, /firma-sello">&nbsp;<\/div><div class="firma">Gerente/);
  assert.equal(signaturesPrintHtml([]), "");
});
