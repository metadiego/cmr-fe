/**
 * Short labels for the top bar's segmented center picker: drop the leading words EVERY center name
 * shares («CMR Bayamon», «CMR Caguas» → «Bayamon», «Caguas»), so the segments stay narrow. Driven by
 * the data, not by a hardcoded prefix: a prefix only some centers share is kept, and a name that
 * would go blank keeps its full form.
 */
export function shortCenterNames(names: readonly string[]): string[] {
  if (names.length < 2) return [...names];
  const words = names.map((n) => n.trim().split(/\s+/));
  let shared = 0;
  while (words.every((w) => w.length > shared + 1 && w[shared] === words[0][shared])) shared++;
  return words.map((w, i) => (shared > 0 ? w.slice(shared).join(" ") : names[i]));
}
