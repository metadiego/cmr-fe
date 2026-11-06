// Cash reconciliation email (BE PR #478, handoff docs/specs/cash-email-gmail-handoff-be.md).
// Pure helpers: recipients typed by the user, and which message to show for each BE outcome.
// Rule from the BE: «sent» ONLY when the SMTP server accepted it (sent:true); otherwise the real error.

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// "a@x.com, b@y.com; c@z.com" (commas, semicolons, spaces or new lines) → valid, de-duplicated,
// lower-cased addresses + the pieces that are not addresses (shown to the user, never sent).
export function parseRecipients(text: string): { emails: string[]; invalid: string[] } {
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const s = raw.trim().toLowerCase();
    if (!s) continue;
    if (!EMAIL_RE.test(s)) invalid.push(raw.trim());
    else if (!emails.includes(s)) emails.push(s);
  }
  return { emails, invalid };
}

export type CashEmailFailure = "notConfigured" | "notSent" | "noRecipients" | "other";

// Maps the BE error (code/status) of a send to the message key the screen shows.
export function cashEmailFailure(err: { code?: string; status?: number } | null | undefined): CashEmailFailure {
  if (err?.code === "MAIL_NOT_CONFIGURED" || err?.status === 503) return "notConfigured";
  if (err?.code === "MAIL_NOT_SENT" || err?.status === 502) return "notSent";
  if (err?.status === 400) return "noRecipients";
  return "other";
}

// Recipients saved as the center default live in the center preference `caja.emailRecipients`.
export function readDefaultRecipients(config: unknown): string[] {
  const list = (config as { caja?: { emailRecipients?: unknown } } | null)?.caja?.emailRecipients;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
}

// Merge (never replace) the center config: only caja.emailRecipients changes.
export function withDefaultRecipients<T extends object>(config: T | null | undefined, emails: string[]): T {
  const base = (config ?? {}) as T & { caja?: Record<string, unknown> };
  return { ...base, caja: { ...(base.caja ?? {}), emailRecipients: emails } } as T;
}
