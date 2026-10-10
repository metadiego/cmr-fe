// How a service board's columns are laid out on screen. Shared by the frontdesk board (one service per
// tab) and the patient desk (several services per patient), so both draw the same columns the same way.
//
// Grouped toggles (render.group, e.g. "flujo_servicio") COLLAPSE into a single "flow" cell placed where
// the group was — never painted again as loose columns. The actions column is drawn apart.

export interface BoardColumnLike {
  clave: string;
  tipo?: string;
  orden: number;
  render?: unknown;
}

export type RenderItem<C> = { kind: "col"; col: C } | { kind: "flujo" };

const isGroupedToggle = (c: BoardColumnLike) => c.tipo === "toggle" && !!(c.render as { group?: string } | null)?.group;
const byOrder = <C extends BoardColumnLike>(cols: C[]) => cols.slice().sort((a, b) => a.orden - b.orden);

// The grouped toggles (the flow steps), in order.
export function flowColumns<C extends BoardColumnLike>(cols: C[]): C[] {
  return byOrder(cols.filter(isGroupedToggle));
}

// The plain columns (no actions, no grouped toggles), in order — what search and sorting look at.
export function plainColumns<C extends BoardColumnLike>(cols: C[]): C[] {
  return byOrder(cols.filter((c) => c.clave !== "fd_acciones" && !isGroupedToggle(c)));
}

// The render list: plain columns with ONE flow cell where the group was. Boards with no toggle columns
// at all get the flow (derived from the board definition) at the end; boards with loose toggles carry
// the flow in them already, so no extra cell (avoids painting it twice).
export function renderColumns<C extends BoardColumnLike>(cols: C[]): RenderItem<C>[] {
  const out: RenderItem<C>[] = [];
  let placed = false;
  for (const c of byOrder(cols)) {
    if (c.clave === "fd_acciones") continue;
    if (isGroupedToggle(c)) {
      if (!placed) {
        out.push({ kind: "flujo" });
        placed = true;
      }
      continue;
    }
    out.push({ kind: "col", col: c });
  }
  if (!placed && !cols.some((c) => c.tipo === "toggle")) out.push({ kind: "flujo" });
  return out;
}
