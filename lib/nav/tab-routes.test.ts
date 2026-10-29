// Tabs as URL paths (lib/nav/tab-routes.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_TABS,
  APPOINTMENTS_TABS,
  BILLING_CONSULTATION_TABS,
  BILLING_GENERAL_TABS,
  PATIENT_TABS,
  legacyTab,
  matchTab,
  screenPathOf,
  tabHref,
} from "./tab-routes.ts";

test("the screen's own route is its default tab", () => {
  assert.deepEqual(matchTab(BILLING_GENERAL_TABS, "/billing/invoices"), { base: "/billing/invoices", tab: "invoices" });
  assert.deepEqual(matchTab(BILLING_GENERAL_TABS, "/billing/invoices/"), { base: "/billing/invoices", tab: "invoices" });
});

test("a tab segment names the tab", () => {
  assert.deepEqual(matchTab(BILLING_GENERAL_TABS, "/billing/invoices/cash"), { base: "/billing/invoices", tab: "cash" });
  assert.deepEqual(matchTab(BILLING_CONSULTATION_TABS, "/billing/consultations/returns"), {
    base: "/billing/consultations",
    tab: "returns",
  });
});

test("a dynamic segment (the patient id) is part of the screen's route", () => {
  assert.deepEqual(matchTab(PATIENT_TABS, "/patients/abc-123"), { base: "/patients/abc-123", tab: "summary" });
  assert.deepEqual(matchTab(PATIENT_TABS, "/patients/abc-123/protocol-change"), {
    base: "/patients/abc-123",
    tab: "protocol-change",
  });
});

test("pages below a tabbed screen are not tabs: invoice detail, new sale, a calendar day", () => {
  assert.equal(matchTab(BILLING_GENERAL_TABS, "/billing/invoices/new"), null);
  assert.equal(matchTab(BILLING_GENERAL_TABS, "/billing/invoices/0b6f2c1e-7d1a-4f43-9b1e-2a7c9d1e0f11"), null);
  assert.equal(matchTab(BILLING_GENERAL_TABS, "/billing/invoices/cash/extra"), null);
  assert.equal(matchTab(APPOINTMENTS_TABS, "/scheduling/appointments/2026-10-29"), null);
  assert.equal(matchTab(APPOINTMENTS_TABS, "/scheduling/appointments/services/2026-10-29"), null);
});

test("a tab of another screen does not count (stats exists only in general billing)", () => {
  assert.equal(matchTab(BILLING_CONSULTATION_TABS, "/billing/consultations/stats"), null);
  assert.equal(matchTab(BILLING_GENERAL_TABS, "/billing/consultations/cash"), null);
});

test("the default tab links to the bare route; the others add their segment", () => {
  assert.equal(tabHref(BILLING_GENERAL_TABS, "/billing/invoices", "invoices"), "/billing/invoices");
  assert.equal(tabHref(BILLING_GENERAL_TABS, "/billing/invoices", "returns"), "/billing/invoices/returns");
  assert.equal(tabHref(PATIENT_TABS, "/patients/abc", "billing"), "/patients/abc/billing");
});

test("a tab link keeps the query string (the center) but drops an old ?tab=", () => {
  assert.equal(
    tabHref(BILLING_GENERAL_TABS, "/billing/invoices", "cash", "centro=c1&tab=caja"),
    "/billing/invoices/cash?centro=c1",
  );
  assert.equal(tabHref(APPOINTMENTS_TABS, "/scheduling/appointments", "medical", new URLSearchParams("tab=servicios")), "/scheduling/appointments");
});

test("old ?tab= values map to the new slugs, unchanged names included", () => {
  assert.equal(legacyTab(BILLING_GENERAL_TABS, "caja"), "cash");
  assert.equal(legacyTab(BILLING_GENERAL_TABS, "estadisticas"), "stats");
  assert.equal(legacyTab(BILLING_CONSULTATION_TABS, "estadisticas"), null);
  assert.equal(legacyTab(APPOINTMENTS_TABS, "servicios"), "services");
  assert.equal(legacyTab(ADMIN_TABS, "editorRol"), "role-editor");
  assert.equal(legacyTab(ADMIN_TABS, "users"), "users");
  assert.equal(legacyTab(ADMIN_TABS, "nope"), null);
  assert.equal(legacyTab(ADMIN_TABS, null), null);
});

test("the shell sees every tab of a screen as the screen itself", () => {
  assert.equal(screenPathOf("/billing/invoices/returns"), "/billing/invoices");
  assert.equal(screenPathOf("/admin/role-editor"), "/admin");
  assert.equal(screenPathOf("/patients/abc/billing"), "/patients/abc");
  assert.equal(screenPathOf("/billing/invoices/new"), "/billing/invoices/new");
  assert.equal(screenPathOf("/patients/legacy-availability/preparation"), "/patients/legacy-availability/preparation");
  assert.equal(screenPathOf("/inventory/stock"), "/inventory/stock");
});
