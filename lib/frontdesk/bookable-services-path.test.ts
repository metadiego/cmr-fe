import { test } from "node:test";
import assert from "node:assert/strict";
import { bookableServicesPath } from "./bookable-services-path.ts";

test("empty center list: no query string", () => {
  assert.equal(bookableServicesPath("p1", []), "/frontdesk/patients/p1/bookable-services");
});
test("one center", () => {
  assert.equal(bookableServicesPath("p1", ["a"]), "/frontdesk/patients/p1/bookable-services?centerIds=a");
});
test("two centers: repeated key, not comma-joined", () => {
  assert.equal(bookableServicesPath("p1", ["a", "b"]), "/frontdesk/patients/p1/bookable-services?centerIds=a&centerIds=b");
});
test("patient id is URL-encoded", () => {
  assert.equal(bookableServicesPath("a/b c", []), "/frontdesk/patients/a%2Fb%20c/bookable-services");
});
