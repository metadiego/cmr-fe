// Checks for «Customize kit» (components/facturacion/personalizar-kit-dialog.tsx).
// The dialog's Save has no required field (an empty kit is a valid choice); only its «Add component»
// sub-row needs a product. The quantity of that row is always clamped to ≥ 1, so it is never missing.

export type CustomizeKitAddField = "product";

/** ["product"] while no product is picked in the «Add component» row. */
export function customizeKitAddMissing(s: { productId: string }): CustomizeKitAddField[] {
  return s.productId ? [] : ["product"];
}
