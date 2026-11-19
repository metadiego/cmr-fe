// «Medidas sin vincular» (BE #509, handoff docs/specs/medidas-glp1-hub-y-bascula-por-imagen-handoff.md):
// scale / tape readings the BE could not attach to a GLP-1 visit on its own. Pure helpers for the hub.

export type MeasurementKind = "scale" | "tape";

/** One row of GET /body-measurements/unlinked, as the screen uses it. */
export interface UnlinkedReading {
  kind: MeasurementKind;
  id: string;
  clinicId: string;
  clinicName: string | null;
  date: string;
  source: string | null;
  createdAt: string | null;
  values: Record<string, number>;
  patient: { id: string; record: string | null; name: string | null } | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Reads a raw row. v2 renames the patient's Spanish keys (nombres → firstName, apellidos → lastName,
 * record → medicalRecordNumber); both spellings are accepted so a rename on either side never blanks
 * the name. Non-numeric values are dropped.
 */
export function readUnlinked(raw: Record<string, unknown>): UnlinkedReading {
  const p = (raw.patient ?? null) as Record<string, unknown> | null;
  const values: Record<string, number> = {};
  for (const [k, v] of Object.entries((raw.values ?? {}) as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    if (Number.isFinite(n)) values[k] = n;
  }
  const last = p ? str(p.lastName) ?? str(p.apellidos) : null;
  const first = p ? str(p.firstName) ?? str(p.nombres) : null;
  const name = p ? str(p.name) ?? ([last, first].filter(Boolean).join(", ") || null) : null;
  return {
    kind: raw.kind === "tape" ? "tape" : "scale",
    id: String(raw.id ?? ""),
    clinicId: String(raw.clinicId ?? ""),
    clinicName: str(raw.clinicName),
    date: String(raw.date ?? "").slice(0, 10),
    source: str(raw.source),
    createdAt: str(raw.createdAt),
    values,
    patient: p
      ? { id: String(p.id ?? ""), record: str(p.medicalRecordNumber) ?? str(p.record), name }
      : null,
  };
}

// The values worth showing first, per kind (the rest follow in the order they came).
const FIRST: Record<MeasurementKind, string[]> = {
  scale: ["weightKg", "bodyFatPct", "bmi", "muscleMassKg", "visceralFat"],
  tape: ["waist", "hip", "abdomen", "chest", "waistHipRatio"],
};

/** The reading's values in display order: the key ones first, then the rest. */
export function valueEntries(r: Pick<UnlinkedReading, "kind" | "values">): Array<[string, number]> {
  const first = FIRST[r.kind].filter((k) => k in r.values);
  const rest = Object.keys(r.values).filter((k) => !first.includes(k));
  return [...first, ...rest].map((k) => [k, r.values[k]]);
}

/** A visit the reading can be linked to (a frontdesk session of that day and center). */
export interface LinkCandidate {
  id: string;
  patientId: string | null;
  patientName: string | null;
  record: string | null;
  serviceName: string | null;
  time: string | null;
  status: string;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The candidates to offer: ONLY GLP-1 visits (BE rejects linking to any other service with
 * BODY_MEASUREMENT_VISIT_TAKES_NO_READINGS), cancelled ones out, filtered by the search (name,
 * record or service), the reading's own patient first, then by time.
 */
export function rankCandidates(
  list: readonly LinkCandidate[],
  opts: { patientId?: string | null; query?: string },
): LinkCandidate[] {
  const q = fold(opts.query?.trim() ?? "");
  const own = (c: LinkCandidate) => (opts.patientId && c.patientId === opts.patientId ? 0 : 1);
  return list
    .filter((c) => c.status !== "cancelada")
    .filter((c) => c.serviceName && /glp/i.test(c.serviceName))
    .filter((c) => !q || [c.patientName, c.record, c.serviceName].some((x) => x && fold(x).includes(q)))
    .slice()
    .sort((a, b) => own(a) - own(b) || String(a.time ?? "").localeCompare(String(b.time ?? "")));
}
