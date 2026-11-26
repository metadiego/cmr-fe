// Short center labels for the top bar's segmented picker (lib/centers/short-names.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { shortCenterNames } from "./short-names.ts";

test("the word every center shares at the start is dropped: «CMR Bayamon» / «CMR Caguas» read Bayamon / Caguas", () => {
  assert.deepEqual(shortCenterNames(["CMR Bayamon", "CMR Caguas"]), ["Bayamon", "Caguas"]);
});

test("a prefix only some centers share is kept, so no label loses information", () => {
  assert.deepEqual(shortCenterNames(["CMR Bayamon", "Clínica Ponce"]), ["CMR Bayamon", "Clínica Ponce"]);
});

test("a single center keeps its full name (there is nothing to compare it with)", () => {
  assert.deepEqual(shortCenterNames(["CMR Bayamon"]), ["CMR Bayamon"]);
});

test("a name that is only the shared prefix keeps its full name instead of going blank", () => {
  assert.deepEqual(shortCenterNames(["CMR", "CMR Caguas"]), ["CMR", "CMR Caguas"]);
});

test("several shared words are dropped and extra spaces do not matter", () => {
  assert.deepEqual(shortCenterNames(["CMR  PR Bayamon", "CMR PR Caguas"]), ["Bayamon", "Caguas"]);
});
