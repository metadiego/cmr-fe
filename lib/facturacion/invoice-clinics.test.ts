// Clinic decisions of the billing lists across clinics. Run: `npm test`.
//
// If these fail, a sale is created in the wrong clinic, or a row's action writes in another clinic.
import test from "node:test";
import assert from "node:assert/strict";
import {
  clinicForNewSale,
  invoiceDetailHref,
  newSaleHref,
  optionsKey,
  rangeTotalScope,
  rowClinicIds,
} from "./invoice-clinics.ts";

const BAY = "bay";
const CAG = "cag";

test("new sale: the filter's single ticked clinic wins over the active one", () => {
  assert.equal(clinicForNewSale([CAG], [BAY, CAG], BAY), CAG);
});

test("new sale: several or none ticked → the active clinic, if the person may bill there", () => {
  assert.equal(clinicForNewSale(null, [BAY, CAG], BAY), BAY);
  assert.equal(clinicForNewSale([BAY, CAG], [BAY, CAG, "x"], CAG), CAG);
});

test("new sale: an active clinic outside the readable ones is not used", () => {
  assert.equal(clinicForNewSale(null, [BAY, CAG], "other"), null);
  assert.equal(clinicForNewSale(null, [BAY], "other"), BAY);
});

test("new sale: readable clinics not loaded yet → trust the active clinic", () => {
  assert.equal(clinicForNewSale(null, [], BAY), BAY);
  assert.equal(clinicForNewSale(null, [], null), null);
});

test("new sale: nothing active and several readable → undecided (the sale screen asks)", () => {
  assert.equal(clinicForNewSale(null, [BAY, CAG], null), null);
});

test("new sale on «Ambos»: several readable clinics → undecided, never the working clinic", () => {
  assert.equal(clinicForNewSale([BAY, CAG], [BAY, CAG], BAY, true), null);
  assert.equal(clinicForNewSale(null, [BAY, CAG], BAY, true), null);
  // Readable clinics still loading: not the working clinic either.
  assert.equal(clinicForNewSale(null, [], BAY, true), null);
});

test("new sale on «Ambos»: one readable clinic is not a question", () => {
  assert.equal(clinicForNewSale([CAG], [CAG], BAY, true), CAG);
  assert.equal(clinicForNewSale(null, [CAG], BAY, true), CAG);
});

test("row clinics: distinct, in order, skipping rows without a clinic", () => {
  assert.deepEqual(rowClinicIds([{ clinicId: CAG }, { clinicId: BAY }, { clinicId: CAG }, { clinicId: null }, {}]), [CAG, BAY]);
});

test("range total: covers the ticked clinics, else every readable one", () => {
  assert.deepEqual(rangeTotalScope(null, [BAY, CAG]), { kind: "many", count: 2 });
  assert.deepEqual(rangeTotalScope([CAG], [BAY, CAG]), { kind: "one", clinicId: CAG });
  assert.deepEqual(rangeTotalScope(null, [BAY]), { kind: "one", clinicId: BAY });
  assert.equal(rangeTotalScope(null, []), null);
});

test("options are keyed per clinic and column", () => {
  assert.notEqual(optionsKey(BAY, "fac_medico"), optionsKey(CAG, "fac_medico"));
});

test("links carry the row's clinic", () => {
  assert.equal(invoiceDetailHref("f1", CAG), "/billing/invoices/f1?centro=cag");
  assert.equal(invoiceDetailHref("f1", null), "/billing/invoices/f1");
  assert.equal(newSaleHref(BAY), "/billing/invoices/new?nuevo=1&centro=bay");
  assert.equal(newSaleHref(null), "/billing/invoices/new?nuevo=1");
});
