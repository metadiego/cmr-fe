// The two message catalogues must carry exactly the same keys.
//
// The app is deliberately bilingual, so Spanish user-facing copy is the product working as
// intended. What is NOT intended is a key that exists only in `es.json`: it leaves a hole that
// nobody sees until an English-speaking user opens that screen, and `next-intl` surfaces it as the
// raw key. Today both files hold 3,214 keys and agree exactly — this test is what keeps that true.
//
// Lives under `lib/` because that is the only place `npm test` looks
// (`node --test "lib/**/*.test.ts"`), the same reason `lib/nav/manifest.test.ts` sits there.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Catalogue = { [key: string]: string | Catalogue };

const load = (locale: string): Catalogue =>
  JSON.parse(
    readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
  ) as Catalogue;

/** Every leaf key, flattened to `namespace.sub.key`, so nesting differences show up too. */
const keys = (catalogue: Catalogue, prefix = ""): string[] =>
  Object.entries(catalogue).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "object" && v !== null ? keys(v, path) : [path];
  });

const es = keys(load("es"));
const en = keys(load("en"));

test("both catalogues are actually loaded (otherwise this test proves nothing)", () => {
  assert.ok(es.length > 1000, `expected a real catalogue, got ${es.length} keys`);
});

test("every Spanish key has an English twin", () => {
  const missing = es.filter((k) => !en.includes(k));
  assert.deepEqual(
    missing,
    [],
    `these keys exist in es.json but not in en.json, so English users would see the raw key:\n${missing.join("\n")}`,
  );
});

test("every English key has a Spanish twin", () => {
  const missing = en.filter((k) => !es.includes(k));
  assert.deepEqual(
    missing,
    [],
    `these keys exist in en.json but not in es.json:\n${missing.join("\n")}`,
  );
});

test("no translation is blank in one language while filled in the other", () => {
  // A blank string is legitimate on its own: `fac.col.accion` and `caja.detalle.footerHelp` are
  // deliberately empty in BOTH catalogues (a column header with no title). What is a bug is a key
  // filled in one language and blank in the other — that is a half-done translation, and it shows
  // up as an empty label for exactly one set of users.
  const flatten = (node: Catalogue, prefix = ""): Map<string, string> => {
    const out = new Map<string, string>();
    for (const [k, v] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "object" && v !== null)
        for (const [kk, vv] of flatten(v, path)) out.set(kk, vv);
      else out.set(path, String(v));
    }
    return out;
  };

  const esValues = flatten(load("es"));
  const enValues = flatten(load("en"));

  const lopsided: string[] = [];
  for (const [key, esValue] of esValues) {
    const enValue = enValues.get(key);
    if (enValue === undefined) continue; // already covered by the parity tests above
    const esBlank = esValue.trim() === "";
    const enBlank = enValue.trim() === "";
    if (esBlank !== enBlank)
      lopsided.push(`${key} — es: ${esBlank ? "(blank)" : "filled"}, en: ${enBlank ? "(blank)" : "filled"}`);
  }

  assert.deepEqual(
    lopsided,
    [],
    `half-translated keys:\n${lopsided.join("\n")}`,
  );
});
