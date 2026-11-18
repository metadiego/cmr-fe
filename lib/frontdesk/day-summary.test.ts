import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DAY_SUMMARY_COLUMNS,
  base64ToBytes,
  groupDaySummary,
  isServiceDayComplete,
  savedReportColumns,
  toggleDaySummaryColumn,
  validEmailList,
  visibleDaySummaryColumns,
  withReportColumns,
} from "./day-summary.ts";

test("visibleDaySummaryColumns keeps table order, drops unknowns, falls back to the defaults", () => {
  assert.deepEqual(visibleDaySummaryColumns(["sealedVials", "record", "bogus"]), ["record", "sealedVials"]);
  assert.deepEqual(visibleDaySummaryColumns(undefined), [...DEFAULT_DAY_SUMMARY_COLUMNS]);
  assert.deepEqual(visibleDaySummaryColumns(["bogus"]), [...DEFAULT_DAY_SUMMARY_COLUMNS]);
  assert.equal(DEFAULT_DAY_SUMMARY_COLUMNS.includes("content"), false);
});

test("toggleDaySummaryColumn adds in order and never hides the last column", () => {
  assert.deepEqual(toggleDaySummaryColumn(["record", "time"], "patient"), ["record", "patient", "time"]);
  assert.deepEqual(toggleDaySummaryColumn(["record", "time"], "time"), ["record"]);
  assert.deepEqual(toggleDaySummaryColumn(["record"], "record"), ["record"]);
});

test("isServiceDayComplete only when every arrival is attended (x/x)", () => {
  assert.equal(isServiceDayComplete({ arrived: 13, attended: 13 }), true);
  assert.equal(isServiceDayComplete({ arrived: 13, attended: 12 }), false);
  assert.equal(isServiceDayComplete({ arrived: 0, attended: 0 }), false);
});

test("withReportColumns merges into the user layer without losing the rest", () => {
  const layer = { idioma: "es", reportColumns: { other: ["a"] } };
  const next = withReportColumns(layer, "frontdesk-day-summary", ["record"]);
  assert.deepEqual(next, { idioma: "es", reportColumns: { other: ["a"], "frontdesk-day-summary": ["record"] } });
  assert.deepEqual(savedReportColumns(next, "frontdesk-day-summary"), ["record"]);
  assert.equal(savedReportColumns(null, "x"), undefined);
  assert.deepEqual(withReportColumns(null, "r", ["x"]), { reportColumns: { r: ["x"] } });
});

test("base64ToBytes and validEmailList", () => {
  assert.equal(new TextDecoder().decode(base64ToBytes(btoa("récord"))).length > 0, true);
  assert.deepEqual([...base64ToBytes("QUI=")], [65, 66]);
  assert.equal(validEmailList("a@b.co, c@d.com"), true);
  assert.equal(validEmailList("a@b"), false);
  assert.equal(validEmailList(" "), false);
});

test("groupDaySummary counts sessions, vials and content per person, most first, unnamed last", () => {
  const rows = [
    { nurse: "Glorimar", sealedVials: 1, content: 25 },
    { nurse: "Britalie", sealedVials: 1, content: 25 },
    { nurse: "Glorimar", sealedVials: 0, content: 10 },
    { nurse: null, sealedVials: 1, content: 25 },
    { nurse: "Glorimar ", sealedVials: 2, content: 40 },
  ];
  assert.deepEqual(groupDaySummary(rows, (r) => r.nurse), [
    { name: "Glorimar", sessions: 3, sealedVials: 3, content: 75 },
    { name: "Britalie", sessions: 1, sealedVials: 1, content: 25 },
    { name: null, sessions: 1, sealedVials: 1, content: 25 },
  ]);
  assert.deepEqual(groupDaySummary([], (r: { n: null; sealedVials: number; content: number }) => r.n), []);
});
