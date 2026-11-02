// The screen's own center picker vs the top bar's (lib/screen-center.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { defaultScreenCenter, isScreenPickerRedundant } from "./screen-center.ts";

test("a manager who can switch the top bar between the same centers: the screen picker is redundant", () => {
  assert.equal(isScreenPickerRedundant(["bay", "cag"], ["bay", "cag"], "bay"), true);
  assert.equal(isScreenPickerRedundant(["cag"], ["bay", "cag"], "cag"), true);
});

test("staff without the top-bar picker (one operative center) keep the screen picker", () => {
  // They were granted read access in Caguas but work in Bayamón: the screen picker is their only way.
  assert.equal(isScreenPickerRedundant(["bay", "cag"], ["bay"], "bay"), false);
  assert.equal(isScreenPickerRedundant(["bay", "cag"], [], null), false);
});

test("the screen offers a center the top bar cannot reach (a read-only grant): keep it", () => {
  assert.equal(isScreenPickerRedundant(["bay", "cag", "pon"], ["bay", "cag"], "bay"), false);
});

test("the top bar sits on a center this screen cannot show: keep the picker, or the screen would silently show another", () => {
  assert.equal(isScreenPickerRedundant(["cag"], ["bay", "cag"], "bay"), false);
});

test("the screen starts on the top bar's center when it can show it", () => {
  assert.equal(defaultScreenCenter(["bay", "cag"], "cag", "bay"), "cag");
});

test("then on the session's center, then on the first one it can show", () => {
  assert.equal(defaultScreenCenter(["bay", "cag"], "pon", "bay"), "bay");
  assert.equal(defaultScreenCenter(["bay", "cag"], null, null), "bay");
  assert.equal(defaultScreenCenter([], "bay", "bay"), "");
});
