// Checks for the invoice's «Add line» row (components/facturacion/invoice-add-item.tsx).
// Only what is EMPTY lives here; prices, quantities and the line payload are computed in the component
// exactly as before and are not touched by this check.

/** "product", or `column.<slug>` for a required capture column (zone, areas…). */
export type AddLineField = "product" | `column.${string}`;

export type AddLineColumn = { slug: string; required?: boolean | null; value: string | null | undefined };

/** Empty required fields, in on-screen order: the product, then the required capture columns. */
export function addLineMissing(s: { productId: string; columns: readonly AddLineColumn[] }): AddLineField[] {
  const out: AddLineField[] = [];
  if (!s.productId) out.push("product");
  for (const c of s.columns) {
    if (c.required && String(c.value ?? "").trim() === "") out.push(`column.${c.slug}`);
  }
  return out;
}
