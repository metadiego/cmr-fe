// Gate for a column that declares `render.requiereEstado` (e.g. the laser technician select stays
// locked until the session is 'presente'). The session map (listSesionesRango) is NOT refreshed when
// the row changes state through SSE, another user or the API, so its stamp can lag behind. The board
// row is the fresh truth: it carries `estado` and a stamp under the state's own key (`presente`).
// Met when ANY source says the state was reached — session stamp, row stamp, or a row state at or
// past the required one in the flow order.

const FLOW_ORDER = ["pendiente", "presente", "en_terapia", "asistido"] as const;

export type RequiredStateInput = {
  required: string | null | undefined;
  sessionStamp?: unknown; // sesion[STAMP_FIELD[required]]
  rowState?: unknown; // fila.estado
  rowStamp?: unknown; // fila[required], e.g. fila.presente
};

export function requiredStateMet({ required, sessionStamp, rowState, rowStamp }: RequiredStateInput): boolean {
  if (!required) return true;
  if (sessionStamp || rowStamp) return true;
  const need = FLOW_ORDER.indexOf(required as (typeof FLOW_ORDER)[number]);
  const have = FLOW_ORDER.indexOf(String(rowState ?? "") as (typeof FLOW_ORDER)[number]);
  return need >= 0 && have >= need;
}
