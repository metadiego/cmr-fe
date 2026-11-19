// The consolidated cash count (owner, 04-nov-2026): a manager with caja.ver_todos may do ONE count of
// the whole drawer — the cuadre with userId null — and that count wins; otherwise the consolidated is
// the SUM of the cashiers' counts. The manager's own cuadre must never be added into that sum.

type CountLine = { denominationId: string; quantity: number };
type Detail = { userId?: string | null; conteo: CountLine[] };

export function consolidatedCount<D extends Detail>(details: D[]): {
  manager: D | null;
  managerCounted: boolean;
  sum: Record<string, number>;
  initial: Record<string, number>;
} {
  const add = (into: Record<string, number>, lines: CountLine[]) => {
    for (const l of lines) into[l.denominationId] = (into[l.denominationId] ?? 0) + l.quantity;
  };
  const manager = details.find((d) => !d.userId) ?? null;
  const sum: Record<string, number> = {};
  for (const d of details) if (d.userId) add(sum, d.conteo);
  const own: Record<string, number> = {};
  if (manager) add(own, manager.conteo);
  const managerCounted = !!manager && manager.conteo.length > 0;
  return { manager, managerCounted, sum, initial: managerCounted ? own : { ...sum } };
}
