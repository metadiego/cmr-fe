// Functions on the staff record and in Configuración › Funciones: label, grouping, what is offered and
// the PUT body. Pure, run with `npm test`.
import type { CatalogFunction, StaffFunction } from "../api/functions.ts";
import type { Translator } from "./positions.ts";

/** `t(labelKey)` when the catalogue has it; otherwise the function's name (services, later additions). */
export function functionLabel(f: Pick<StaffFunction, "labelKey" | "name">, t: Translator): string {
  return f.labelKey && t.has(f.labelKey) ? t(f.labelKey) : f.name;
}

/** Active functions, plus inactive ones the person already holds (never hidden from them). */
export function offeredFunctions(catalog: readonly CatalogFunction[], held: readonly string[]): CatalogFunction[] {
  return catalog.filter((f) => f.active || held.includes(f.slug));
}

const byOrder = (a: CatalogFunction, b: CatalogFunction) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug);

export function groupFunctions(list: readonly CatalogFunction[]): { services: CatalogFunction[]; tasks: CatalogFunction[] } {
  return {
    services: list.filter((f) => f.kind === "service").sort(byOrder),
    tasks: list.filter((f) => f.kind === "task").sort(byOrder),
  };
}

export function toggleFunction(held: readonly string[], slug: string): string[] {
  return held.includes(slug) ? held.filter((s) => s !== slug) : [...held, slug];
}

export function sameFunctions(a: readonly string[], b: readonly string[]): boolean {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((s) => y.has(s));
}

/** The PUT body: the complete list, deduplicated and sorted. */
export function functionsBody(held: readonly string[]): { functions: string[] } {
  return { functions: [...new Set(held)].sort() };
}

export function holdsFunction(held: readonly Pick<StaffFunction, "slug">[] | null | undefined, slug: string): boolean {
  return !!held?.some((f) => f.slug === slug);
}
