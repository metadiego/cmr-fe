import type { Transicion } from "@/lib/api/tablero";
import { slugOffered } from "../lifecycle/allowed-actions.ts";
import {
  flowRank,
  rowReach,
  transitionFromGroups,
  transitionStartsFrom,
  transitionToGroup,
} from "../lifecycle/board-catalogue.ts";
import { rowGroup, type AppointmentKind, type StagedRow } from "../lifecycle/stage-groups.ts";

export type { EstadoLite } from "../board/row-colour.ts";

export type ToggleResuelto = {
  checked: boolean;
  canCheck: boolean;
  canUncheck: boolean;
  disabled: boolean;
  // The action to run if pressed NOW. `null` = no-op: the box must do nothing.
  action: string | null;
};

const INERT: ToggleResuelto = { checked: false, canCheck: false, canUncheck: false, disabled: true, action: null };

// Decides what a care-flow box (PRESENTE / EN CONSULTA / ASISTIDO) does, without React, so it can be
// tested. Everything is read by STAGE GROUP (piece 6b), from the row's stages and the transition's
// groups (`toGroup` / `fromGroups` on the 6b backend, mapped from the old words on 6a):
//   1. Checked = the row got at least as far as this box's target group on the care flow. A row closed
//      after arriving (not served) reached the waiting room and no further; a row closed before arriving
//      reached nothing.
//   2. The "back" is the reverse of THIS BOX's step (a transition leaving its target group for an
//      earlier step of the flow), never any transition going down from the ROW's group (bug
//      atencion-la-segunda-casilla-deshace-la-primera: «En consulta» used to undo «Presente»).
//   3. Only the LAST active step undoes (the row's group is this box's target), so a box evaluated
//      `checked` by a render glitch never sends another step's back.
// With the row's `allowedActions` (cmr-be 4a) a move is offered only if listed.
export function resolveToggle(params: {
  /** The row's lifecycle kind; null (a board of another entity) leaves the box inert. */
  kind: AppointmentKind | null;
  row: StagedRow;
  forwardSlug: string | undefined;
  transiciones: readonly Transicion[];
  optimistic?: boolean;
  busy?: boolean;
  allowed?: readonly string[] | null;
}): ToggleResuelto {
  const { kind, row, forwardSlug, transiciones, optimistic, busy, allowed } = params;
  if (!kind) return INERT;
  const listed = (slug: string | undefined) => !slug || slugOffered(slug, allowed) !== false;
  const rank = (t: Transicion) => flowRank(kind, transitionToGroup(kind, t));

  const forward = forwardSlug ? transiciones.find((t) => t.slug === forwardSlug) : undefined;
  const target = forward ? transitionToGroup(kind, forward) : null;
  const targetRank = flowRank(kind, target);
  const group = rowGroup(kind, row);

  const baseChecked = !!forward && targetRank >= 0 && rowReach(kind, row) >= targetRank;
  const checked = optimistic ?? baseChecked;

  // Reverse of THIS step: leaves the box's target group for an earlier step of the flow.
  const back =
    forward && target !== null
      ? transiciones.find((t) => transitionFromGroups(kind, t).includes(target) && rank(t) >= 0 && rank(t) < targetRank)
      : undefined;

  const canCheck = !checked && !!forward && transitionStartsFrom(kind, forward, group) && listed(forward.slug);
  const isLast = target !== null && group === target;
  const canUncheck = checked && isLast && !!back && listed(back.slug);
  const disabled = !!busy || (!checked && !canCheck) || (checked && !canUncheck);

  // Recomputed here (not a bare "checked ? back : forward"): a box that can neither advance nor undo
  // is a no-op and never sends the back of a step that is not its own.
  const action = checked ? (canUncheck ? (back?.slug ?? null) : null) : canCheck ? (forward?.slug ?? null) : null;

  return { checked, canCheck, canUncheck, disabled, action };
}
