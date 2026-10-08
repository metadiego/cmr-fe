import { test } from "node:test";
import assert from "node:assert/strict";
import { urlAfterCenterSwitch } from "./after-center-switch.ts";

const CAG = "5f98ef29-5b71-4fc4-8291-0ca3ff50bc7d";
const BAY = "ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1";

test("a Caguas invoice, switching to Bayamón → Bayamón's invoice list (the case the owner saw)", () => {
  assert.equal(
    urlAfterCenterSwitch("/billing/invoices/265cc89a-cccc-4fde-81ee-9bfc31cc29ad", `?centro=${CAG}`, BAY),
    `/billing/invoices?centro=${BAY}`,
  );
});

test("invoice sub-screens (return, return receipt) also go back to the list", () => {
  assert.equal(urlAfterCenterSwitch("/billing/invoices/abc/return", `?centro=${CAG}`, BAY), `/billing/invoices?centro=${BAY}`);
  assert.equal(urlAfterCenterSwitch("/billing/invoices/abc/returns/d1/receipt", "", BAY), "/billing/invoices");
});

test("a stock transfer detail goes back to the transfers list", () => {
  assert.equal(urlAfterCenterSwitch("/inventory/transfers/t1", "", BAY), "/inventory/transfers");
});

test("'new' screens are not records: they stay, with the center rewritten", () => {
  assert.equal(urlAfterCenterSwitch("/billing/invoices/new", `?nuevo=1&centro=${CAG}`, BAY), `/billing/invoices/new?nuevo=1&centro=${BAY}`);
  assert.equal(urlAfterCenterSwitch("/inventory/transfers/new", "", BAY), "/inventory/transfers/new");
});

test("a list pinned to the old center by ?centro= is re-pinned to the new one (else the switch is undone)", () => {
  assert.equal(urlAfterCenterSwitch("/billing/invoices", `?centro=${CAG}&q=x`, BAY), `/billing/invoices?centro=${BAY}&q=x`);
});

test("pages shared across centers just reload where they are", () => {
  assert.equal(urlAfterCenterSwitch("/patients/p1", "?tab=compras", BAY), "/patients/p1?tab=compras");
  assert.equal(urlAfterCenterSwitch("/boards/frontdesk", "", BAY), "/boards/frontdesk");
  assert.equal(urlAfterCenterSwitch("/scheduling/appointments/2026-10-08", "", BAY), "/scheduling/appointments/2026-10-08");
});
