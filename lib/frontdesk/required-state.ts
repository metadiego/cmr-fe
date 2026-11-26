// Gate for a column that declares `render.requiereEstado` (e.g. the laser technician select stays
// locked until the session is 'presente'). The session map (listSesionesRango) is NOT refreshed when
// the row changes state through SSE, another user or the API, so its stamp can lag behind. The board
// row is the fresh truth: it carries `estado` and a stamp under the state's own key (`presente`).
// Met when ANY source says the state was reached — session stamp, row stamp, or a row whose stage
// group is at or past the required step in the flow order.

import type { StagedRow, StageGroup } from "../lifecycle/stage-groups.ts";
import { rowGroup } from "./row-stages.ts";

// The service flow's steps in order: the catalogue slug a column names in `render.requiereEstado`
// (board_statuses, Ruling 3) and the stage group a row is in once it reached that step.
const FLOW: ReadonlyArray<readonly [step: string, group: StageGroup]> = [
  ["pendiente", "upcoming"],
  ["presente", "waiting"],
  ["en_terapia", "in_therapy"],
  ["asistido", "done"],
];

export type RequiredStateInput = {
  required: string | null | undefined;
  sessionStamp?: unknown; // sesion[STAMP_FIELD[required]]
  row?: StagedRow; // the board row (its status) with its session's stages, see sessionRowStaged
  rowStamp?: unknown; // fila[required], e.g. fila.presente
};

export function requiredStateMet({ required, sessionStamp, row, rowStamp }: RequiredStateInput): boolean {
  if (!required) return true;
  if (sessionStamp || rowStamp) return true;
  const need = FLOW.findIndex(([step]) => step === required);
  const group = row ? rowGroup("therapy", row) : null;
  const have = FLOW.findIndex(([, g]) => g === group);
  return need >= 0 && have >= need;
}
