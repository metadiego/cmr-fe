import { test } from "node:test";
import assert from "node:assert/strict";

import { ehrReadinessInvalid, ehrReadinessMissing, ehrReadinessOrder } from "./ehr-readiness-missing.ts";

const all = ["zipcode", "sexo", "docId", "fechaNacimiento", "idType"] as const;
const full = {
  idType: "passport",
  docId: "X123",
  fechaNacimiento: "1980-05-01",
  sexo: "femenino",
  zipcode: "00961",
};

test("ehrReadinessOrder: ID type first, then ID, then the rest", () => {
  assert.deepEqual(ehrReadinessOrder(all), ["idType", "docId", "fechaNacimiento", "sexo", "zipcode"]);
});
for (const f of all) {
  test(`ehrReadinessMissing: blank ${f} → listed`, () => {
    assert.deepEqual(ehrReadinessMissing(all, { ...full, [f]: "  " }), [f]);
  });
}
test("ehrReadinessMissing: empty form → every requested field, in display order", () => {
  assert.deepEqual(ehrReadinessMissing(["sexo", "docId"], {}), ["docId", "sexo"]);
});
test("ehrReadinessMissing: only the requested fields count", () => {
  assert.deepEqual(ehrReadinessMissing(["zipcode"], { zipcode: "00961" }), []);
});
test("ehrReadinessMissing: all present → []", () => {
  assert.deepEqual(ehrReadinessMissing(all, full), []);
});
test("ehrReadinessInvalid: future birth date → futureBirthDate", () => {
  assert.equal(ehrReadinessInvalid({ fechaNacimiento: "2026-11-17" }, "2026-11-16"), "futureBirthDate");
});
test("ehrReadinessInvalid: today, past or blank → null", () => {
  assert.equal(ehrReadinessInvalid({ fechaNacimiento: "2026-11-16" }, "2026-11-16"), null);
  assert.equal(ehrReadinessInvalid({ fechaNacimiento: "1980-01-01" }, "2026-11-16"), null);
  assert.equal(ehrReadinessInvalid({}, "2026-11-16"), null);
});
