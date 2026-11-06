import { test } from "node:test";
import assert from "node:assert/strict";

import { completeEmail, completeRecipients, domainSuggestions, lastToken, readEmailDomains } from "./domains.ts";

const D = ["centrodemedicinaregenerativa.com", "cmr.pr"];

test("readEmailDomains: the preference list, cleaned; anything else = empty", () => {
  assert.deepEqual(readEmailDomains({ email: { domains: [" @CentroDeMedicinaRegenerativa.com", "cmr.pr", "cmr.pr", 3, ""] } }), D);
  assert.deepEqual(readEmailDomains({ email: {} }), []);
  assert.deepEqual(readEmailDomains(null), []);
});

test("completeEmail: a bare user part gets the FIRST domain; full addresses are kept as typed", () => {
  assert.equal(completeEmail("larciles", D), "larciles@centrodemedicinaregenerativa.com");
  assert.equal(completeEmail(" sheila.gonzalez ", D), "sheila.gonzalez@centrodemedicinaregenerativa.com");
  assert.equal(completeEmail("larciles@", D), "larciles@centrodemedicinaregenerativa.com");
  assert.equal(completeEmail("ana@gmail.com", D), "ana@gmail.com");
  assert.equal(completeEmail("ana@centr", D), "ana@centr"); // a partial domain is a suggestion, not a guess
  assert.equal(completeEmail("", D), "");
});

test("completeEmail / completeRecipients: an empty list behaves exactly as today", () => {
  assert.equal(completeEmail("larciles", []), "larciles");
  assert.equal(completeRecipients("a, b", []), "a, b");
});

test("completeRecipients: each recipient on its own", () => {
  assert.equal(
    completeRecipients("larciles, ana@gmail.com;sheila.gonzalez", D),
    "larciles@centrodemedicinaregenerativa.com, ana@gmail.com, sheila.gonzalez@centrodemedicinaregenerativa.com",
  );
  assert.equal(completeRecipients("   ", D), "   ");
});

test("lastToken splits the recipient being typed off the list", () => {
  assert.deepEqual(lastToken("a@x.com, larc"), { head: "a@x.com, ", token: "larc" });
  assert.deepEqual(lastToken("larc"), { head: "", token: "larc" });
  assert.deepEqual(lastToken("a, "), { head: "a, ", token: "" });
});

test("domainSuggestions: only after '@', matching the typed start, never the completed one", () => {
  assert.deepEqual(domainSuggestions("ana@", D), ["ana@centrodemedicinaregenerativa.com", "ana@cmr.pr"]);
  assert.deepEqual(domainSuggestions("ana@cen", D), ["ana@centrodemedicinaregenerativa.com"]);
  assert.deepEqual(domainSuggestions("ana@cmr.pr", D), []);
  assert.deepEqual(domainSuggestions("ana", D), []);
  assert.deepEqual(domainSuggestions("@cen", D), []);
  assert.deepEqual(domainSuggestions("ana@gm", D), []);
});
