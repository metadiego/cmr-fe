"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { setStaffFunctions, type CatalogFunction, type StaffFunction } from "@/lib/api/functions";
import { functionLabel, functionsBody, groupFunctions, offeredFunctions, sameFunctions, toggleFunction } from "@/lib/personal/functions";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSaveSection } from "@/components/personal/save-group";
import { ErrorState } from "@/components/kit/panel";

// «Funciones» on the staff record (cmr-be handoff §2.2): what the person does — services and tasks —
// with no center. Never opens a screen (that is «Rol de acceso»). Saved with the record's single
// "Save" as the COMPLETE list. Unticking a task a job position backs (Técnico…) also removes that
// position in the BE; for a login that changes its centers only an administrator may (403).
export function StaffFunctionsSection({
  staffId,
  catalog,
  catalogError,
  held,
  canEdit,
  centro,
  onSaved,
}: {
  staffId: string;
  /** `GET /functions?includeInactive=true`. */
  catalog: CatalogFunction[];
  /** Why the catalog or the person's functions did not load (shown instead of a skeleton that never ends). */
  catalogError?: string | null;
  /** What the person holds; null while it loads. */
  held: StaffFunction[] | null;
  /** The viewer holds staff.update at the person's home center. */
  canEdit: boolean;
  /** The person's home center (tenant of the write). */
  centro?: string;
  onSaved: (now: StaffFunction[]) => void;
}) {
  const t = useTranslations("staffFunctions");
  const tRoot = useTranslations();
  const heldSlugs = React.useMemo(() => (held ?? []).map((f) => f.slug), [held]);
  const [draft, setDraft] = React.useState<string[] | null>(null);
  const current = draft ?? heldSlugs;
  const dirty = draft !== null && !sameFunctions(draft, heldSlugs);

  useSaveSection("functions", dirty, async () => {
    const now = await setStaffFunctions(staffId, functionsBody(current), centro);
    setDraft(null);
    onSaved(now);
  });

  const { services, tasks } = groupFunctions(offeredFunctions(catalog, heldSlugs));
  const loading = held === null || catalog.length === 0;

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="space-y-0.5">
        <Label>{t("title")}</Label>
        <p className="text-xs text-muted-foreground">{canEdit ? t("help") : t("readOnly")}</p>
      </div>
      {catalogError ? (
        <ErrorState message={catalogError} />
      ) : loading ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-full animate-pulse rounded-full bg-muted" />
        </div>
      ) : (
        // Two rows (tasks, then services), each a column grid of checkboxes: easy to scan, no pill soup.
        // «Presencial» is the norm, so only «Cualquier centro» is marked.
        <div className="space-y-4">
          {([["tasks", tasks], ["services", services]] as const).map(([group, list]) => {
            const count = list.filter((f) => current.includes(f.slug)).length;
            return (
              <fieldset key={group} className="space-y-2">
                <legend className="flex w-full items-baseline justify-between text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <span>{t(`group.${group}`)}</span>
                  <span className="tabular-nums normal-case">{t("selectedCount", { count, total: list.length })}</span>
                </legend>
                <p className="text-xs text-muted-foreground">{t(`groupHelp.${group}`)}</p>
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("emptyGroup")}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 rounded-lg border p-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {list.map((f) => {
                      const on = current.includes(f.slug);
                      const id = `fn-${staffId}-${f.slug}`;
                      return (
                        <label
                          key={f.slug}
                          htmlFor={id}
                          className={cn(
                            "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                            canEdit ? "cursor-pointer hover:bg-accent" : "cursor-default",
                            on ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          <Checkbox
                            id={id}
                            checked={on}
                            disabled={!canEdit}
                            onCheckedChange={() => setDraft(toggleFunction(current, f.slug))}
                          />
                          <span className="truncate" title={functionLabel(f, tRoot)}>{functionLabel(f, tRoot)}</span>
                          {f.place === "any_center" && (
                            <span className="ml-auto shrink-0 rounded bg-info px-1.5 py-0.5 text-[10px] font-normal text-info-foreground">
                              {t("placeShort.any_center")}
                            </span>
                          )}
                          {!f.active && <span className="shrink-0 text-[10px] font-normal text-muted-foreground">· {t("inactive")}</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
      )}
      {!loading && current.length === 0 && <p className="text-xs text-warning-foreground">{t("none")}</p>}
    </div>
  );
}
