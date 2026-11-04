import { test } from "node:test";
import assert from "node:assert/strict";

import { isPlainKey, isTypingTarget } from "./keys.ts";

test("isTypingTarget: inputs, textareas, selects and contentEditable", () => {
  assert.ok(isTypingTarget({ tagName: "INPUT" }));
  assert.ok(isTypingTarget({ tagName: "TEXTAREA" }));
  assert.ok(isTypingTarget({ tagName: "SELECT" }));
  assert.ok(isTypingTarget({ tagName: "DIV", isContentEditable: true }));
  assert.ok(!isTypingTarget({ tagName: "BUTTON" }));
  assert.ok(!isTypingTarget(null));
});

test("isPlainKey: no modifiers, no auto-repeat", () => {
  const k = { ctrlKey: false, metaKey: false, altKey: false };
  assert.ok(isPlainKey(k));
  assert.ok(!isPlainKey({ ...k, metaKey: true }));
  assert.ok(!isPlainKey({ ...k, ctrlKey: true }));
  assert.ok(!isPlainKey({ ...k, altKey: true }));
  assert.ok(!isPlainKey({ ...k, repeat: true }));
});
