// "Avisar, nunca bloquear" (owner, 10-nov; BE #547, agenda/rules per center): el BE ya decide qué
// regla bloquea de verdad (GET/PUT /agenda/rules/:centerId; feriado bloquea por defecto, el resto solo
// avisa) y manda `selectable` hecho. Antes de #547 esto se calculaba a mano con esta lista fija (BE
// #533, agenda.fullSlotPolicy 'warn'); se deja como RESPALDO solo para una respuesta vieja sin
// `selectable` (nunca debería pasar hoy, pero una hora sin la regla nueva no debe quedar deshabilitada
// por error).
export const WARN_ONLY_REASONS: readonly string[] = ["therapies.full", "therapies.noStaff", "therapies.sheetFull"];

type Slot = { fits: boolean; reasonKey?: string | null; selectable?: boolean };

/** Can the desk pick this slot? The BE's `selectable` wins; the old heuristic is a fallback only. */
export function slotPickable(s: Slot): boolean {
  if (s.selectable !== undefined) return s.selectable;
  return s.fits || (!!s.reasonKey && WARN_ONLY_REASONS.includes(s.reasonKey));
}

/** Pickable but doesn't fit: drawn amber, with its reason(s), and booked with a warning. */
export function slotWarns(s: Slot): boolean {
  return !s.fits && slotPickable(s);
}
