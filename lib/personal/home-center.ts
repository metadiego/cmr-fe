// «Centro de origen» on the staff record (cmr-be docs/specs/staff-home-center.md): the BE needs
// `staff.update` at the current home AND the new one. Pure, run with `npm test`.

type CenterLike = { id: string; name: string; active?: boolean };

export type HomeCenterBlock = "noUpdateAtCurrent" | "noOtherCenter" | null;

/** Options for the selector (current + active centers the viewer can edit) and why it is locked, if it is. */
export function homeCenterChoice<C extends CenterLike>(
  centers: readonly C[],
  current: string,
  editable: ReadonlySet<string>,
): { options: C[]; blocked: HomeCenterBlock } {
  const currentCenter = centers.filter((c) => c.id === current);
  if (!editable.has(current)) return { options: currentCenter, blocked: "noUpdateAtCurrent" };
  const options = centers.filter((c) => c.id === current || (c.active !== false && editable.has(c.id)));
  return { options, blocked: options.length > 1 ? null : "noOtherCenter" };
}
