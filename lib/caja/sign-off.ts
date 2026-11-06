// Cash sheet sign-off («Acepto», BE #486, handoff docs/specs/cash-sign-off-handoff.md).
// Pure helpers: which signature is live, whether the sheet moved after it was signed, the blocks the
// screen and the printed sheet show, and the text the signer accepts. Mirrors cmr-be
// src/modules/caja/sheet-report.ts (figuresOf / figuresChanged) and cash-sign-off.service.ts (forSheet).

export type SignOffRole = "cashier" | "supervisor";

// Signing as MANAGER is its own permission. caja.ver_todos cannot tell a manager from a biller: on prod
// (6-nov-2026) all six cash roles hold it, Facturación and Facturador included, so billers saw
// «Firmar como gerente». Handoff docs/specs/cash-sign-as-manager-permission-handoff-be.md.
export const SIGN_AS_SUPERVISOR = "caja.sign_as_manager";

export interface SignedFigures {
  dayTotal: number;
  salesCash: number;
  countedCash: number;
  difference: number;
}

export interface CashSignature {
  id: string;
  reconciliationId: string;
  role: SignOffRole;
  staffId: string;
  signerName: string;
  statement: string;
  signedAt: string;
  figures: SignedFigures;
  voidedAt: string | null;
  voidReason: string | null;
}

const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;

// The figures a signer agrees to, read from the day report exactly as the BE reads it: day total,
// cash sales, and the BE's reconciliation (counted cash + difference). Same source both sides, so a
// fresh signature never shows up as «signed with other figures».
export function figuresOfReport(report: {
  detalle?: { total?: number; efectivo?: { amount?: number } };
  reconciliation?: { countedCash?: number; difference?: number } | null;
}): SignedFigures {
  return {
    dayTotal: r2(report.detalle?.total),
    salesCash: r2(report.detalle?.efectivo?.amount),
    countedCash: r2(report.reconciliation?.countedCash),
    difference: r2(report.reconciliation?.difference),
  };
}

// Did the sheet move since it was signed? (a late phone sale, a corrected count)
export function figuresChanged(signed: SignedFigures, now: SignedFigures): boolean {
  return (
    r2(signed.dayTotal) !== r2(now.dayTotal) ||
    r2(signed.salesCash) !== r2(now.salesCash) ||
    r2(signed.countedCash) !== r2(now.countedCash) ||
    r2(signed.difference) !== r2(now.difference)
  );
}

// The live (not voided) signature of a role; the newest wins if the history has more than one.
export function liveSignature(list: CashSignature[], role: SignOffRole): CashSignature | null {
  let best: CashSignature | null = null;
  for (const s of list) {
    if (s.role !== role || s.voidedAt) continue;
    if (!best || s.signedAt > best.signedAt) best = s;
  }
  return best;
}

// 409 CASH_SHEET_ALREADY_SIGNED: someone else signed in that role. The body carries who and when.
export function alreadySignedBy(
  err: { code?: string; status?: number; data?: Record<string, unknown> } | null | undefined,
): { signedBy: string; signedAt: string | null } | null {
  if (!err || (err.code !== "CASH_SHEET_ALREADY_SIGNED" && err.status !== 409)) return null;
  const by = err.data?.signedBy;
  const at = err.data?.signedAt;
  return { signedBy: typeof by === "string" ? by : "—", signedAt: typeof at === "string" ? at : null };
}

// The text the signer accepts: center preference caja.signOff.statement (the BE stores the one it
// actually used on each signature, so this is only what the dialog shows BEFORE signing).
export function readSignOffStatement(config: unknown): string | null {
  const s = (config as { caja?: { signOff?: { statement?: unknown } } } | null)?.caja?.signOff?.statement;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

/** A cashier sheet a consolidated / day-total sheet sums. */
export interface SiblingSheet {
  id: string;
  userId: string;
  name: string | null;
  division?: string | null;
}

/** One signature block: its label under the line; over it, who accepted and when (blank if unsigned). */
export interface SignatureBlock {
  key: string;
  role: SignOffRole;
  /** Name for «Cajero — NAME» blocks; null = the plain role label. */
  cashierName: string | null;
  signature: CashSignature | null;
  /** The sheet moved after this signature: shown in red with the figures it accepted. */
  changed: boolean;
}

// The blocks of a sheet, as the BE email draws them: a cashier's sheet = «Cajero» + «Gerente»; a
// consolidated / day total = one «Cajero — name» per cashier sheet it sums (her signature THERE, judged
// against that sheet's own figures), then «Gerente» (the signature on this sheet).
export function signatureBlocks(args: {
  own: CashSignature[];
  now: SignedFigures;
  isCashierSheet: boolean;
  siblings?: Array<SiblingSheet & { signatures: CashSignature[]; now: SignedFigures | null }>;
}): SignatureBlock[] {
  const { own, now, isCashierSheet, siblings = [] } = args;
  const block = (key: string, role: SignOffRole, cashierName: string | null, s: CashSignature | null, current: SignedFigures | null): SignatureBlock => ({
    key,
    role,
    cashierName,
    signature: s,
    changed: !!s && !!current && figuresChanged(s.figures, current),
  });
  const supervisor = block("supervisor", "supervisor", null, liveSignature(own, "supervisor"), now);
  if (isCashierSheet) return [block("cashier", "cashier", null, liveSignature(own, "cashier"), now), supervisor];
  const cashiers = siblings.map((sib) => {
    const s = liveSignature(sib.signatures, "cashier");
    return block(`cashier:${sib.id}`, "cashier", s?.signerName ?? sib.name ?? "—", s, sib.now);
  });
  return [...(cashiers.length ? cashiers : [block("cashier", "cashier", null, null, null)]), supervisor];
}

/** A block already put into words (translated + formatted) for the printed sheet. */
export interface PrintedSignature {
  label: string;
  line?: string;
  warning?: string;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// The signature row of the printed sheet: the accepted statement, then per block «Aceptado por … ·
// fecha» (and the red note) OVER the line, the label UNDER it.
export function signaturesPrintHtml(blocks: PrintedSignature[], statement?: string | null): string {
  if (!blocks.length) return "";
  const cells = blocks
    .map(
      (b) =>
        `<div class="firma-wrap"><div class="firma-sello">${b.line ? esc(b.line) : "&nbsp;"}${
          b.warning ? `<div class="rojo">${esc(b.warning)}</div>` : ""
        }</div><div class="firma">${esc(b.label)}</div></div>`,
    )
    .join("");
  return `${statement ? `<p class="firma-texto">${esc(statement)}</p>` : ""}<div class="firmas">${cells}</div>`;
}
