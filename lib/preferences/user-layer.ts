// The user's preference layer as /me/preferences RETURNS it is not what the PUT must SEND: the v2 edge
// translates the stored `idioma` to `language` on the way out, but nothing translates it back on the way
// in, so writing the layer back as read stores a raw `language` the BE does not read, and the user's
// language silently falls to the default (verified live 18-nov-2026: a column save turned a Spanish
// account English). Every read-merge-PUT of the layer goes through this.
export function userLayerForPut<T extends Record<string, unknown>>(layer: T | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(layer ?? {}) };
  if ("language" in out) {
    if (out.idioma == null && typeof out.language === "string") out.idioma = out.language;
    delete out.language;
  }
  return out;
}
