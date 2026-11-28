"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { setStaffFunctions, type CatalogFunction, type StaffFunction } from "@/lib/api/functions";
import { functionLabel, functionsBody, groupFunctions, offeredFunctions, sameFunctions, toggleFunction } from "@/lib/personal/functions";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
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
        <div className="grid gap-4 lg:grid-cols-2">
          {([["tasks", tasks], ["services", services]] as const).map(([group, list]) => (
            <div key={group} className="space-y-1.5">
              <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t(`group.${group}`)}</div>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("emptyGroup")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {list.map((f) => {
                    const on = current.includes(f.slug);
                    return (
                      <button
                        key={f.slug}
                        type="button"
                        aria-pressed={on}
                        disabled={!canEdit}
                        title={t(`place.${f.place}`)}
                        onClick={() => setDraft(toggleFunction(current, f.slug))}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          on ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                          !canEdit && "cursor-not-allowed opacity-70 hover:bg-transparent",
                        )}
                      >
                        {on ? "✓ " : ""}
                        {functionLabel(f, tRoot)}
                        <span className={cn("rounded px-1 text-[10px] font-normal", on ? "bg-primary/10" : "bg-muted")}>
                          {t(`placeShort.${f.place}`)}
                        </span>
                        {!f.active && <span className="text-[10px] font-normal">· {t("inactive")}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && current.length === 0 && <p className="text-xs text-warning-foreground">{t("none")}</p>}
    </div>
  );
}
