import { test } from "node:test";
import assert from "node:assert/strict";

import { doseOptionsOf, packageGateFrom } from "./package-gate.ts";
import { ApiError } from "../api/types.ts";
import type { FrontdeskColumna } from "../api/frontdesk.ts";

const doseCol = { clave: "fd_dosis", render: { optionsSource: "productos_grupo" } } as unknown as FrontdeskColumna;
const otherCol = { clave: "fd_otro" } as unknown as FrontdeskColumna;
const colsRender = [{ kind: "col" as const, col: otherCol }, { kind: "col" as const, col: doseCol }, { kind: "flujo" as const }];
const options = { fd_dosis: [{ value: "p1", label: "NANO" }] };

test("doseOptionsOf: finds the productos_grupo column's own options", () => {
  assert.deepEqual(doseOptionsOf(colsRender, options), [{ value: "p1", label: "NANO" }]);
});

test("doseOptionsOf: no productos_grupo column, or no options for it: empty list, never a crash", () => {
  assert.deepEqual(doseOptionsOf([{ kind: "col", col: otherCol }], options), []);
  assert.deepEqual(doseOptionsOf(colsRender, {}), []);
});

test("packageGateFrom: NO_PACKAGE_TO_ATTEND builds the full gate, with this row's dose options", () => {
  const err = new ApiError("NO_PACKAGE_TO_ATTEND", "sin sesiones", 422, undefined, undefined, {
    service: "NANO",
    packagesWithoutBalance: ["pkg-1"],
  });
  const onCompleted = () => {};
  const gate = packageGateFrom(err, colsRender, options, "pat-1", onCompleted);
  assert.deepEqual(gate, {
    patientId: "pat-1",
    service: "NANO",
    packagesWithoutBalance: ["pkg-1"],
    productOptions: [{ value: "p1", label: "NANO" }],
    onCompleted,
  });
});

test("packageGateFrom: a different error: null — nothing to gate", () => {
  assert.equal(packageGateFrom(new Error("boom"), colsRender, options, "pat-1", () => {}), null);
});
