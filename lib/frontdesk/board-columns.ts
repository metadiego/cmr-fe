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

const stampRank = (a: string | null | undefined, b: string | null | undefined) =>
  a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0;

// Natural order of a service board (no column clicked): here NOW (presente/en_terapia) by first
// arrival, then pendiente by its appointment time, then asistido by when it FINISHED, cancelada
// last. Found live 12-oct-2026 (owner, Vit C): sorting everyone by `presente` alone put an asistido
// row — stamped with its own morning arrival — above people still actually in the room, because
// finishing a therapy does not erase that old stamp. Shared by the frontdesk board and the patient
// desk's service rows so neither has to re-derive this.
export function sortBoardRowsNatural<R>(
  rows: R[],
  opts: {
    estadoOf: (row: R) => string;
    presenteOf: (row: R) => string | null | undefined;
    asistidoOf: (row: R) => string | null | undefined;
    scheduledTimeOf: (row: R) => string | null | undefined;
  }
): R[] {
  const rankOf = (estado: string) =>
    estado === "presente" || estado === "en_terapia"
      ? 0
      : estado === "pendiente"
        ? 1
        : estado === "asistido"
          ? 2
          : estado === "cancelada"
            ? 3
            : 1;
  return [...rows].sort((a, b) => {
    const ra = rankOf(opts.estadoOf(a));
    const rb = rankOf(opts.estadoOf(b));
    if (ra !== rb) return ra - rb;
    if (ra === 0) return stampRank(opts.presenteOf(a), opts.presenteOf(b));
    if (ra === 1) return stampRank(opts.scheduledTimeOf(a), opts.scheduledTimeOf(b));
    if (ra === 2) return stampRank(opts.asistidoOf(a), opts.asistidoOf(b));
    return 0;
  });
}
