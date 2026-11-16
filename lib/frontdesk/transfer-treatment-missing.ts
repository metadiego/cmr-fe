// Checks for the "Transfer treatment to another center" dialog (components/frontdesk/sesiones-cell.tsx).
// Empty → missing; filled but not acceptable → `transferTreatmentInvalid` (it keeps the button disabled, as today).

export type TransferTreatmentState = {
  /** Destination center id ("" = not chosen). */
  destination: string;
  mode: "virtual" | "fisica";
  /** Warehouses, required only in "fisica" (physical) mode. */
  sourceWarehouse: string;
  destinationWarehouse: string;
  /** Sessions typed; empty means "all pending" (optional field). */
  sessions: string;
  /** Pending sessions of the package. */
  pending: number;
};

export type TransferTreatmentField = "destination" | "sourceWarehouse" | "destinationWarehouse";

export type TransferTreatmentProblem = "nothingPending" | "sessionsOutOfRange";

/** Empty required fields, in on-screen order. */
export function transferTreatmentMissing(s: TransferTreatmentState): TransferTreatmentField[] {
  const out: TransferTreatmentField[] = [];
  if (!s.destination) out.push("destination");
  if (s.mode === "fisica") {
    if (!s.sourceWarehouse) out.push("sourceWarehouse");
    if (!s.destinationWarehouse) out.push("destinationWarehouse");
  }
  return out;
}

/** Why the filled values cannot be saved, or null. */
export function transferTreatmentInvalid(s: TransferTreatmentState): TransferTreatmentProblem | null {
  if (s.pending <= 0) return "nothingPending";
  if (s.sessions.trim() === "") return null;
  const n = Number(s.sessions);
  return !Number.isFinite(n) || n <= 0 || n > s.pending ? "sessionsOutOfRange" : null;
}
