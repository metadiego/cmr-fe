"use client";

import { colourStatuses } from "@/lib/agenda/status-field";
import { getDefinicion, type TableroDefinicion } from "@/lib/api/tablero";
import { CONSULTATION_BOARD } from "@/lib/frontdesk/consultation-board";
import { useResource } from "@/hooks/use-resource";

// The appointment form's status colours. Create reads the call center board (appointments.read, which the
// modal already needs); edit prefers the consultation board (frontdesk.read) and falls back to the call
// center's when the user cannot read it. Both serve production's colours on every backend.
export function useStatusColours(isEdit: boolean): TableroDefinicion["statuses"] {
  const cc = useResource<TableroDefinicion>(() => getDefinicion("citas_cc"));
  const consultation = useResource<TableroDefinicion | null>(
    () => (isEdit ? getDefinicion(CONSULTATION_BOARD).catch(() => null) : Promise.resolve(null)),
    [isEdit],
  );
  return colourStatuses(
    isEdit,
    consultation.state.kind === "ok" ? consultation.state.data?.statuses ?? null : null,
    cc.state.kind === "ok" ? cc.state.data.statuses : null,
  );
}
