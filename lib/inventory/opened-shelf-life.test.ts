import { test } from "node:test";
import assert from "node:assert/strict";

import { openedShelfLife } from "./opened-shelf-life.ts";

test("opened shelf life: empty is no limit (null), a whole number >= 1 is kept, anything else is invalid", () => {
  assert.deepEqual(openedShelfLife(""), { value: null, invalid: false });
  assert.deepEqual(openedShelfLife(" 28 "), { value: 28, invalid: false });
  assert.deepEqual(openedShelfLife("0"), { value: null, invalid: true });
  assert.deepEqual(openedShelfLife("1.5"), { value: null, invalid: true });
  assert.deepEqual(openedShelfLife("abc"), { value: null, invalid: true });
});
