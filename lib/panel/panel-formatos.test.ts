import { test } from "node:test";
import assert from "node:assert/strict";

import { fillableReportsFor } from "./panel-formatos.ts";

const servicios = [
  {
    id: "s1",
    name: "GLP-1",
    formActions: { reports: [{ id: "glp1_adherencia", name: "Adherencia" }, { id: "hilt", name: "HILT" }] },
  },
  { id: "s2", name: "Láser", formActions: { reports: [{ id: "hilt", name: "HILT" }, { id: "mls", name: "MLS" }] } },
  { id: "s3", name: "Sin formatos", formActions: null },
];

test("matches by serviceId when present, keeping only screen-fillable sheets (not every report)", () => {
  const reports = fillableReportsFor({ serviceId: "s1", serviceName: "otro nombre" }, servicios);
  assert.deepEqual(reports.map((r) => r.id), ["glp1_adherencia"]);
});

test("falls back to the display name while serviceId is missing (BE #663 not yet live, or an old event)", () => {
  const reports = fillableReportsFor({ serviceId: null, serviceName: "GLP-1" }, servicios);
  assert.deepEqual(reports.map((r) => r.id), ["glp1_adherencia"]);
});

test("a service with only printable reports (HILT/MLS) offers nothing fillable on screen", () => {
  assert.deepEqual(fillableReportsFor({ serviceId: "s2", serviceName: "Láser" }, servicios), []);
});

test("no matching service, or one with no formAcciones at all, offers nothing", () => {
  assert.deepEqual(fillableReportsFor({ serviceId: "s3", serviceName: "Sin formatos" }, servicios), []);
  assert.deepEqual(fillableReportsFor({ serviceId: "nope", serviceName: "nope" }, servicios), []);
});

test("serviceId wins over the display name when both would resolve to a different service", () => {
  // The name "Láser" would match s2 (HILT/MLS only), but the id correctly points at s1 (GLP-1).
  const reports = fillableReportsFor({ serviceId: "s1", serviceName: "Láser" }, servicios);
  assert.deepEqual(reports.map((r) => r.id), ["glp1_adherencia"]);
});
