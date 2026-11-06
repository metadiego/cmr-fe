// House email domains (handoff docs/specs/email-domain-autocomplete-handoff.md). The list is DATA:
// system preference `email.domains`, ordered, the first one is the main one. Pure helpers used by
// components/email-input.tsx: complete a bare user part, and suggest a domain while typing after "@".

// effective.email.domains → clean, lower-cased, de-duplicated, without a leading "@".
export function readEmailDomains(effective: unknown): string[] {
  const list = (effective as { email?: { domains?: unknown } } | null)?.email?.domains;
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const d of list) {
    if (typeof d !== "string") continue;
    const s = d.trim().replace(/^@+/, "").toLowerCase();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

const USER_PART = /^[^\s@,;]+$/;

// One address: a bare user part ("sheila.gonzalez") gets "@" + the FIRST domain; "name@" gets the first
// domain too; anything else (a full address, gmail included) is kept exactly as typed.
export function completeEmail(text: string, domains: string[]): string {
  const s = text.trim();
  if (!s || !domains.length) return text;
  if (USER_PART.test(s)) return `${s}@${domains[0]}`;
  if (s.endsWith("@") && USER_PART.test(s.slice(0, -1))) return `${s}${domains[0]}`;
  return text;
}

// A list ("a, b; c@gmail.com"): each recipient is completed on its own; separators become ", ".
export function completeRecipients(text: string, domains: string[]): string {
  if (!domains.length) return text;
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) return text;
  return parts.map((p) => completeEmail(p, domains)).join(", ");
}

// The recipient being typed in a list = whatever follows the last separator.
export function lastToken(text: string): { head: string; token: string } {
  const m = /^([\s\S]*[\s,;])?([^\s,;]*)$/.exec(text);
  return { head: m?.[1] ?? "", token: m?.[2] ?? text };
}

// While typing after "@": the full addresses the listed domains would make, matching what is typed.
// Nothing when there is no "@" yet, when the domain is already complete, or the list is empty.
export function domainSuggestions(token: string, domains: string[]): string[] {
  const at = token.indexOf("@");
  if (at <= 0 || token.indexOf("@", at + 1) !== -1) return [];
  const user = token.slice(0, at);
  const typed = token.slice(at + 1).toLowerCase();
  return domains.filter((d) => d.startsWith(typed) && d !== typed).map((d) => `${user}@${d}`);
}
