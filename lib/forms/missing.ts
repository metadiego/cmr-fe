export type Check = readonly [label: string, ok: boolean];

/** Labels of the failing checks, in order, without duplicates. */
export function missingFields(checks: readonly Check[]): string[] {
  const out: string[] = [];
  for (const [label, ok] of checks) {
    if (!ok && !out.includes(label)) out.push(label);
  }
  return out;
}

export type FooterInput = {
  missing?: readonly string[];
  reason?: string | null;
  blocked?: boolean;
  submitting?: boolean;
};

export type Hint =
  | { kind: "missing"; items: string[] }
  | { kind: "reason"; text: string }
  | null;

/** Whether the submit button is disabled and which hint the footer shows. */
export function footerState(i: FooterInput): { disabled: boolean; hint: Hint } {
  const missing = i.missing ?? [];
  const reason = i.reason ? i.reason : null;
  const disabled = missing.length > 0 || !!i.blocked || !!i.submitting;
  let hint: Hint = null;
  if (missing.length > 0) hint = { kind: "missing", items: [...missing] };
  else if (reason) hint = { kind: "reason", text: reason };
  return { disabled, hint };
}
