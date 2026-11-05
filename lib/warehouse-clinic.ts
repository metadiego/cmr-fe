// Inventory writes keyed by a warehouse (a purchase receipt, a receipt from a supplier invoice, a purchase
// order). A warehouse belongs to ONE clinic, and the BE writes the receipt in the request's clinic and
// refuses a warehouse of another one (ALMACEN_DE_OTRO_CENTRO). With the top bar on «Ambos» the warehouse
// picker lists every clinic's warehouses, so the warehouse picked IS the clinic picked: the request
// carries the warehouse's clinic (docs/specs/selector-de-centros-arriba.md). Run: `npm test`.

export interface WarehouseLike {
  id: string;
  name: string;
  clinicId?: string | null;
  clinicName?: string | null;
}

/** The clinic of the warehouse picked; `undefined` when none is picked or it carries no clinic. */
export function warehouseClinic(warehouses: readonly WarehouseLike[], warehouseId: string): string | undefined {
  if (!warehouseId) return undefined;
  return warehouses.find((w) => w.id === warehouseId)?.clinicId ?? undefined;
}

/** An option's label: the warehouse's name, plus its clinic when the list mixes clinics. */
export function warehouseLabel(warehouse: WarehouseLike, warehouses: readonly WarehouseLike[]): string {
  const clinics = new Set(warehouses.map((w) => w.clinicId).filter(Boolean));
  return clinics.size > 1 && warehouse.clinicName ? `${warehouse.name} · ${warehouse.clinicName}` : warehouse.name;
}

/**
 * Whether a receipt may be sent. Without a warehouse the BE picks the working clinic's, which on «Ambos»
 * is a clinic nobody chose: there the warehouse is required.
 */
export function warehouseReady(warehouseId: string, viewAll: boolean): boolean {
  return !!warehouseId || !viewAll;
}
