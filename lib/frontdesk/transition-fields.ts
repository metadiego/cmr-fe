// Required fields of a board transition (servicio.formActions.campos, e.g. laser `aplicadas` on
// `asistido`). A field counts as filled when the session data or the row carries a value. A field that
// is still empty there but shows a VISIBLE unsaved value in its cell (the proposal pre-filled from the
// visit sheet, or a number typed whose debounced save has not landed) also counts: it is saved first and
// the transition runs after. Only a field with neither blocks (cmr-fe docs/specs/asistir-con-areas-sugeridas.md).

export type TransitionField = { clave: string; labelKey?: string; en?: string; requerido?: boolean };

/** A cell's visible, not yet saved value: the board column that saves it and the value shown. */
export type PendingCellValue = { column: string; value: number; label?: string };

export type TransitionFieldsPlan = {
  /** Visible values to save before the transition, in the order the fields are declared. */
  toSave: (PendingCellValue & { clave: string })[];
  /** Fields with no value anywhere: these block the transition. */
  missing: TransitionField[];
};

const hasValue = (v: unknown) => v != null && v !== "" && v !== "—";

/** Filled when ANY source has a value: session data, or the row's resolved/edited select columns. */
export function fieldFilled(clave: string, data: Record<string, unknown>, row: Record<string, unknown>): boolean {
  return [data[clave], row[clave], row[`fd_${clave}`], row[`${clave}__valor`], row[`fd_${clave}__valor`]].some(hasValue);
}

export function planTransitionFields(
  fields: TransitionField[],
  state: string,
  data: Record<string, unknown>,
  row: Record<string, unknown>,
  pending: Record<string, PendingCellValue | undefined>,
): TransitionFieldsPlan {
  const plan: TransitionFieldsPlan = { toSave: [], missing: [] };
  for (const f of fields) {
    if (!f.requerido || f.en !== state || fieldFilled(f.clave, data, row)) continue;
    const p = pending[f.clave];
    if (p && Number.isFinite(p.value)) plan.toSave.push({ clave: f.clave, ...p });
    else plan.missing.push(f);
  }
  return plan;
}
