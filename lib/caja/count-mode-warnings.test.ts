import { test } from "node:test";
import assert from "node:assert/strict";

import { sortWarnings, warningSeverity, warningValues } from "./count-mode-warnings.ts";
import { money } from "./totales.ts";

const override = {
  code: "CONSOLIDATED_COUNT_OVERRIDES_CASHIERS",
  labelKey: "caja.countMode.consolidatedOverridesCashiers",
  division: "general" as const,
  params: { counted: 200, cashiersCounted: 250, difference: -50 },
};

test("the consolidated override is red; unknown codes stay amber", () => {
  assert.equal(warningSeverity(override.code), "destructive");
  assert.equal(warningSeverity("DIVISION_NOT_COUNTED"), "warning");
});

test("red warnings go first, BE order kept otherwise", () => {
  const a = { code: "A" }, b = { code: "B" };
  assert.deepEqual(sortWarnings([a, override, b]).map((w) => w.code), [override.code, "A", "B"]);
});

test("params become money, next to the division label", () => {
  assert.deepEqual(warningValues(override, "General"), {
    division: "General",
    counted: money(200),
    cashiersCounted: money(250),
    difference: money(-50),
  });
});

test("no params: only the division, nothing breaks", () => {
  assert.deepEqual(warningValues({ code: "X", labelKey: "k", division: "general" }, "General"), { division: "General" });
  assert.deepEqual(warningValues({ code: "X", labelKey: "k" }), {});
});
