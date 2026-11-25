// Pure logic for the "Estatus de enfermería" admin screen (configuration/nursing-statuses):
// slug/labelKey derivation and the durationOptions parsing/validation the BE itself does not
// (its controller takes an inline body, confirmed by a peer session 25-nov-2026 — no
// class-validator DTO, so nothing server-side rejects a bad shape before it hits the DB).

// Lowercase, ASCII, snake_case — matches what the BE peer asked for. Accented letters are
// folded (NFD + strip combining marks) before stripping anything non [a-z0-9], so "Añadió " →
// "anadio", not "adi" (the accent would otherwise just vanish along with the letter under it).
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function labelKeyFor(slug: string): string {
  return `nurse_status.${slug}`;
}

/** Parses the editor's comma/space-separated minutes text into the API's `durationOptions`. */
export function parseDurationOptions(text: string): number[] {
  return [...new Set(text.split(/[,\s]+/).map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= 720))].sort(
    (a, b) => a - b,
  );
}

/** Whether the raw text has a token that is NOT a valid whole minute 1–720 (so the user sees why it was dropped). */
export function durationOptionsHasInvalidToken(text: string): boolean {
  return text
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .some((s) => {
      const n = Number(s);
      return !Number.isInteger(n) || n < 1 || n > 720;
    });
}
