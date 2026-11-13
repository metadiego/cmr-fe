import { test } from "node:test";
import assert from "node:assert/strict";

import {
  signatureState,
  alreadySignedBy,
  figuresChanged,
  figuresOfReport,
  liveSignature,
  readSignOffStatement,
  signatureBlocks,
  signatureChangeFigures,
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

test("signatureChangeFigures: signed vs today's total + delta, not the cash difference AT signing", () => {
  // Owner, 13-nov: «Firmado con otras cifras: total $42,245.91 · diferencia $0.00» read as "nothing
  // changed" — `difference` there was the cash difference when accepted (0, it cuadró that day), not
  // how much the day total moved since (it dropped $220 after a payment got corrected).
  const [block] = signatureBlocks({ own: [sig({ figures: { ...figs, dayTotal: 42245.91, difference: 0 } })], now: { ...figs, dayTotal: 42025.91, difference: 0 }, isCashierSheet: true });
  assert.deepEqual(signatureChangeFigures(block), { signed: 42245.91, now: 42025.91, delta: -220, signedDifference: null });
});

test("signatureChangeFigures: the cash difference at signing shows ONLY when it was non-zero", () => {
  const [block] = signatureBlocks({ own: [sig({ figures: { ...figs, dayTotal: 500, difference: 5 } })], now: { ...figs, dayTotal: 535, difference: 5 }, isCashierSheet: true });
  assert.deepEqual(signatureChangeFigures(block), { signed: 500, now: 535, delta: 35, signedDifference: 5 });
});

test("signatureChangeFigures: null when nothing changed, or unsigned", () => {
  const [unchanged] = signatureBlocks({ own: [sig({})], now: figs, isCashierSheet: true });
  assert.equal(signatureChangeFigures(unchanged), null);
  const [unsigned] = signatureBlocks({ own: [], now: figs, isCashierSheet: true });
  assert.equal(signatureChangeFigures(unsigned), null);
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

test("signatureState: moved and not acknowledged = red; acknowledged on today's figures = quiet; moved again = red (BE #565)", () => {
  const signed = { dayTotal: 810, salesCash: 200, countedCash: 250, difference: 0 };
  const now = { dayTotal: 810, salesCash: 360, countedCash: 250, difference: 0 };
  const sig = { figures: signed, acknowledgedFigures: null } as unknown as Parameters<typeof signatureState>[0];
  assert.deepEqual(signatureState(sig, signed), { changed: false, acknowledged: false });
  assert.deepEqual(signatureState(sig, now), { changed: true, acknowledged: false });
  const acked = { ...sig, acknowledgedFigures: now } as typeof sig;
  assert.deepEqual(signatureState(acked, now), { changed: false, acknowledged: true });
  assert.deepEqual(signatureState(acked, { ...now, salesCash: 400 }), { changed: true, acknowledged: false });
  assert.deepEqual(signatureState(sig, null), { changed: false, acknowledged: false });
});
