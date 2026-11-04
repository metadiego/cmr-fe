import { test } from "node:test";
import assert from "node:assert/strict";

import { blocksViewShortcut, isPlainKey, isTypingTarget, OPEN_MODAL_SELECTOR } from "./keys.ts";

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

test("blocksViewShortcut: open modal, typing, or inside a widget that owns its letters", () => {
  const el = (tagName: string, inside: string | null = null) => ({
    tagName,
    closest: (sel: string) => (inside && sel.includes(`[role="${inside}"]`) ? {} : null),
  });
  assert.ok(!blocksViewShortcut(el("BUTTON"), false));
  assert.ok(!blocksViewShortcut(null, false));
  assert.ok(blocksViewShortcut(el("BUTTON"), true)); // a modal is open somewhere
  assert.ok(blocksViewShortcut(el("INPUT"), false));
  for (const role of ["dialog", "alertdialog", "menu", "listbox", "option", "combobox"]) {
    assert.ok(blocksViewShortcut(el("DIV", role), false), role);
  }
  assert.ok(OPEN_MODAL_SELECTOR.includes('[data-state="open"]'));
});
