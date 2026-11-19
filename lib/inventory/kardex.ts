// Pure helpers of the daily kardex screen (app/(app)/inventory/kardex). Tested in kardex.test.ts.

import type { KardexDayMovement } from "@/lib/api/inventory-kardex";

/** The period the screen opens on: the 1st of the current month through today (both YYYY-MM-DD). */
export function defaultKardexRange(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** «3/10» when the movement belongs to a session plan; null otherwise. */
export function sessionLabel(n: number | null | undefined, total: number | null | undefined): string | null {
  return n != null && total != null ? `${n}/${total}` : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A document reference worth printing (a transfer number), not an internal UUID. */
export function readableDocument(id: string | null | undefined): string | null {
  const v = id?.trim();
  return v && !UUID.test(v) ? v : null;
}

/** A range is usable when both ends are days and from ≤ to. */
export function validRange(from: string, to: string): boolean {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  return day.test(from) && day.test(to) && from <= to;
}

/**
 * One row of the day's detail dialog (owner, 18-nov-2026: "ponlo en una sola línea porque confunde" —
 * a single IV delivery writes several raw movements, one per inventory dimension: opening a sealed
 * vial is a VIAL-count movement, drawing its content for the patient is a separate CONTENT movement
 * (grams/mL), and a correction can reverse either. All of them share the same `documentId` (the
 * frontdesk session that produced them), which is the one field that reliably ties them together —
 * never the free-text `notes`, which only repeats that same id as a sentence.
 */
export type KardexDayGroup = {
  key: string;
  patientName: string | null;
  medicalRecordNumber: string | null;
  sessionNumber: number | null;
  sessionsTotal: number | null;
  /** Net change to the sealed-vial count (movements with openVial = false). Usually 0 or negative. */
  vials: number;
  /** Net change to opened-vial content, in the product's unit (movements with openVial = true). */
  content: number;
  /** Set when a movement of the group was dated in the past (cmr-be #646): when it was really written. */
  retroactiveRecordedAt: string | null;
};

/**
 * Collapses one delivery's raw movements into one row: grouped by `documentId` (every movement a
 * single frontdesk delivery produced shares it), falling back to the movement's own id when there is
 * none (a standalone adjustment has nothing to merge with). Order of first appearance is kept.
 */
export function groupKardexDayMovements(movements: readonly KardexDayMovement[]): KardexDayGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, KardexDayGroup>();
  for (const m of movements) {
    const key = m.documentId ?? `movement:${m.id}`;
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        patientName: m.patient?.name ?? null,
        medicalRecordNumber: m.medicalRecordNumber ?? m.patient?.medicalRecordNumber ?? null,
        sessionNumber: m.sessionNumber,
        sessionsTotal: m.sessionsTotal,
        vials: 0,
        content: 0,
        retroactiveRecordedAt: null,
      };
      byKey.set(key, g);
      order.push(key);
    }
    if (m.isRetroactive && !g.retroactiveRecordedAt) g.retroactiveRecordedAt = m.recordedAt ?? null;
    if (m.openVial) g.content += m.signedQuantity;
    else g.vials += m.signedQuantity;
  }
  return order.map((key) => byKey.get(key)!);
}

/** The owner's sheet arithmetic: opening + Σinbound − Σmanual − appliedNet + correctionsNet. */
export function ownerClosing(f: {
  opening: number;
  inbound: { quantity: number }[];
  manualOutputs: { quantity: number }[];
  appliedNet: number;
  correctionsNet: number;
}): number {
  const sum = (xs: { quantity: number }[]) => xs.reduce((a, x) => a + (Number(x.quantity) || 0), 0);
  return f.opening + sum(f.inbound) - Math.abs(sum(f.manualOutputs)) - f.appliedNet + f.correctionsNet;
}
