import { test } from "node:test";
import assert from "node:assert/strict";

import { shouldSubmitOnEnter, type EnterEvent } from "./enter.ts";

const base: EnterEvent = {
  key: "Enter",
  shiftKey: false,
  isComposing: false,
  targetTag: "INPUT",
  targetRole: null,
  targetExpanded: false,
};

test("Enter in an INPUT submits", () => {
  assert.equal(shouldSubmitOnEnter(base, false), true);
});
test("Enter while disabled does not submit", () => {
  assert.equal(shouldSubmitOnEnter(base, true), false);
});
test("Enter in a TEXTAREA does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, targetTag: "TEXTAREA" }, false), false);
});
test("Shift+Enter in an INPUT does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, shiftKey: true }, false), false);
});
test("Enter during IME composition does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, isComposing: true }, false), false);
});
test("Enter on an expanded combobox does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, targetRole: "combobox", targetExpanded: true }, false), false);
});
test("Enter on a BUTTON does not submit (the button handles its own click)", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, targetTag: "BUTTON" }, false), false);
});
test("another key does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, key: "a" }, false), false);
});
test("Enter on a SELECT does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, targetTag: "SELECT" }, false), false);
});
test("Enter on a link (A) does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, targetTag: "A" }, false), false);
});
test("Enter on role button, link or menuitem does not submit", () => {
  for (const targetRole of ["button", "link", "menuitem"]) {
    assert.equal(shouldSubmitOnEnter({ ...base, targetRole }, false), false, targetRole);
  }
});
test("Enter with keyCode 229 (Safari IME) does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, keyCode: 229 }, false), false);
});
test("Enter on role option does not submit", () => {
  assert.equal(shouldSubmitOnEnter({ ...base, targetRole: "option" }, false), false);
});
