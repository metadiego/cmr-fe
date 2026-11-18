import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { HAND_ROLLED_CARD_PATTERN, LEGACY_CARD_FILES } from "../../eslint/legacy-card-files.mjs";

// The lint exemption for hand-rolled cards (CLAUDE.md rule 10) is a list that may only shrink. These
// tests make a stale entry fail: once a file is moved onto the kit, its line must go, so the list
// never carries an exemption nobody needs (which would let that file slide back silently).

test("every legacy card file still exists", () => {
  const missing = LEGACY_CARD_FILES.filter((f) => !existsSync(f));
  assert.deepEqual(missing, [], "Deleted or renamed: remove these lines from eslint/legacy-card-files.mjs");
});

test("every legacy card file still uses the hand-rolled card (otherwise delete its line)", () => {
  const clean = LEGACY_CARD_FILES.filter((f) => existsSync(f) && !HAND_ROLLED_CARD_PATTERN.test(readFileSync(f, "utf8")));
  assert.deepEqual(clean, [], "Already on the kit: remove these lines from eslint/legacy-card-files.mjs");
});

test("the list has no duplicates and never exempts the shadcn primitives", () => {
  assert.equal(new Set(LEGACY_CARD_FILES).size, LEGACY_CARD_FILES.length);
  assert.deepEqual(LEGACY_CARD_FILES.filter((f) => f.startsWith("components/ui/")), []);
});

test("the pattern matches the hand-rolled card and not the kit's tokens", () => {
  assert.ok(HAND_ROLLED_CARD_PATTERN.test("rounded-md bg-card ring-1 ring-foreground/10"));
  assert.ok(HAND_ROLLED_CARD_PATTERN.test("shadow-sm shadow-[rgba(16,32,64,0.06)]"));
  assert.ok(!HAND_ROLLED_CARD_PATTERN.test("rounded-xl border bg-card shadow-xs"));
});
