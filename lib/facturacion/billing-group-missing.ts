// Checks for the billing-group admin forms: the «New group» sheet
// (components/facturacion/grupos-admin.tsx) and the «Add field» dialog
// (components/facturacion/como-se-cobra.tsx). Text counts as filled after trim.

export type NewBillingGroupField = "key";
export type NewBillingFieldField = "name";

/** ["key"] while the group key is blank. The label key and division are optional / always set. */
export function newBillingGroupMissing(s: { key: string }): NewBillingGroupField[] {
  return s.key.trim() === "" ? ["key"] : [];
}

/** ["name"] while the field name is blank. Type and the multiplier switch always have a value. */
export function newBillingFieldMissing(s: { name: string }): NewBillingFieldField[] {
  return s.name.trim() === "" ? ["name"] : [];
}
