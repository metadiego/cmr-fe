import { test } from "node:test";
import assert from "node:assert/strict";

import { addLineMissing } from "./add-line-missing.ts";

test("addLineMissing: no product → listed", () => {
  assert.deepEqual(addLineMissing({ productId: "", columns: [] }), ["product"]);
});
test("addLineMissing: required column blank → listed", () => {
  assert.deepEqual(
    addLineMissing({ productId: "p1", columns: [{ slug: "zona", required: true, value: " " }] }),
    ["column.zona"],
  );
});
test("addLineMissing: required column with no value at all → listed", () => {
  assert.deepEqual(
    addLineMissing({ productId: "p1", columns: [{ slug: "zona", required: true, value: undefined }] }),
    ["column.zona"],
  );
});
test("addLineMissing: optional blank column → not listed", () => {
  assert.deepEqual(addLineMissing({ productId: "p1", columns: [{ slug: "dosis", required: false, value: "" }] }), []);
});
test("addLineMissing: several missing → in on-screen order", () => {
  assert.deepEqual(
    addLineMissing({
      productId: "",
      columns: [
        { slug: "areas", required: true, value: "" },
        { slug: "dias", required: false, value: "" },
        { slug: "zona", required: true, value: "" },
      ],
    }),
    ["product", "column.areas", "column.zona"],
  );
});
test("addLineMissing: all present → []", () => {
  assert.deepEqual(
    addLineMissing({ productId: "p1", columns: [{ slug: "zona", required: true, value: "rodilla" }] }),
    [],
  );
});
