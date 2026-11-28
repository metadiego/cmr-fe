"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Personal } from "@/lib/api/personal";
import { getStaffPositions, setStaffPositions, type Position, type StaffPositions } from "@/lib/api/positions";
import { getCenters, getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { buildPositionsBody, centersOf, chipState, effectivePrimary } from "@/lib/personal/positions";
import { draftOnLoad, draftOnSave, isDraftDirty, type PositionsDraft } from "@/lib/personal/positions-draft";
import {
  RETIRED_ACCESS_ROLES,
  accessRoleCatalog,
  hiddenHeldPositions,
  primaryIsHidden,
  withHiddenPositions,
} from "@/lib/personal/access-roles";
import { useResource } from "@/hooks/use-resource";
import { useMe, isAdmin } from "@/hooks/use-me";
import { Label } from "@/components/ui/label";
import { useSaveSection } from "@/components/personal/save-group";
import { PositionsPicker } from "@/components/personal/positions-picker";

// «Rol de acceso» on the staff record (cmr-be handoff rol-de-acceso-funciones-y-horario §4): what the
// person can open, per center; their centers are the rows with a role. Admins only (the page mounts it
// for them). The job positions (no permissions, a function of the same slug) are edited in «Funciones»
// and hidden here, but the PUT takes the COMPLETE list, so they are re-sent untouched, and a job
// position that is the person's primary stays the primary. `centro` = the person's home clinic.
export function StaffPositionsSection({
  persona,
  catalog: fullCatalog,
  functionSlugs,
  catalogError,
  centro,
}: {
  persona: Personal;
  catalog: Position[];
  /** Every function slug (`GET /functions`): a 0-permission position with one of these is a job position. */
  functionSlugs: string[];
  /** Why the position catalog did not load (shown instead of a skeleton that never ends). */
  catalogError?: string | null;
  centro?: string;
}) {
  const t = useTranslations("staffPositions");
  const me = useMe();
  const viewerIsAdmin = me.kind === "ok" && isAdmin(me.me);
  // Reloads when the record gets its login too: the invite drops permission positions and saves new ones.
  const heldRes = useResource<StaffPositions>(
    () => getStaffPositions(persona.id, centro),
    [persona.id, centro, persona.profileId],
  );
  const centersRes = useResource<Centro[]>(() => getCenters());
  const editableRes = useResource<Centro[]>(() => getCentrosDondePuedo("staff.update").catch(() => []));

  const centers = React.useMemo(() => (centersRes.state.kind === "ok" ? centersRes.state.data : []), [centersRes.state]);
  const editable = React.useMemo(
    () => new Set((editableRes.state.kind === "ok" ? editableRes.state.data : []).map((c) => c.id)),
    [editableRes.state],
  );
  const centerIds = React.useMemo(() => centers.map((c) => c.id), [centers]);
  const loaded = heldRes.state.kind === "ok" ? heldRes.state.data : null;
  const catalog = React.useMemo(
    () => accessRoleCatalog(fullCatalog, functionSlugs, RETIRED_ACCESS_ROLES, (loaded?.positions ?? []).map((h) => h.position)),
    [fullCatalog, functionSlugs, loaded],
  );
  // The picker only sees the access roles; the same object per load (draftOnLoad compares identity).
  const held = React.useMemo(() => {
    if (!loaded) return null;
    const shown = new Set(catalog.map((p) => p.slug));
    return { ...loaded, positions: loaded.positions.filter((h) => shown.has(h.position)) };
  }, [loaded, catalog]);
  const hidden = React.useMemo(() => (loaded ? hiddenHeldPositions(loaded, catalog) : []), [loaded, catalog]);
  const hiddenPrimary = loaded && primaryIsHidden(loaded, catalog) ? loaded.primary : null;

  // Loaded / saved / edited state (lib/personal/positions-draft): a save's result is never overwritten
  // by the pre-save load the fetcher still holds. Seeded during render (no effect).
  const [draft, setDraft] = React.useState<PositionsDraft | null>(null);
  const ready = held !== null && centersRes.state.kind === "ok" && catalog.length > 0 && functionSlugs.length > 0;
  if (ready) {
    const next = draftOnLoad(draft, held, catalog, centerIds);
    if (next !== draft) setDraft(next);
  }
  const grid = draft?.grid ?? null;
  const shownPrimary = draft ? effectivePrimary(draft.primary, draft.grid, catalog) : null;

  useSaveSection("positions", !!draft && isDraftDirty(draft, catalog), async () => {
    if (!draft) throw new Error("positions are not loaded");
    const body = withHiddenPositions(buildPositionsBody(draft.grid, draft.primary, catalog), hidden, hiddenPrimary);
    const result = await setStaffPositions(persona.id, body, centro);
    const shown = new Set(catalog.map((p) => p.slug));
    setDraft(draftOnSave(draft, { ...result, positions: result.positions.filter((h) => shown.has(h.position)) }, catalog, centerIds));
  });

  // Rows: every center the viewer can edit staff in, plus every center where the person already holds
  // a position (shown read-only when the viewer cannot edit there).
  const rows = grid
    ? centers.filter((c) => editable.has(c.id) || centersOf(grid).includes(c.id)).map((c) => ({ id: c.id, name: c.name }))
    : [];

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="space-y-0.5">
        <Label>{t("title")}</Label>
        <p className="text-xs text-muted-foreground">{t("help")}</p>
      </div>
      {catalogError && <p className="text-sm text-destructive">{catalogError}</p>}
      {heldRes.state.kind === "fail" && <p className="text-sm text-destructive">{heldRes.state.message}</p>}
      {centersRes.state.kind === "fail" && <p className="text-sm text-destructive">{centersRes.state.message}</p>}
      {!grid && !catalogError && heldRes.state.kind !== "fail" && centersRes.state.kind !== "fail" && (
        <div className="space-y-2" aria-hidden>
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-full animate-pulse rounded-full bg-muted" />
        </div>
      )}
      {grid && (
        <>
          <PositionsPicker
            idPrefix={`staff-${persona.id}`}
            catalog={catalog}
            centers={rows}
            grid={grid}
            onChange={(g) => setDraft((d) => (d ? { ...d, grid: g } : d))}
            primary={shownPrimary}
            onPrimaryChange={(p) => setDraft((d) => (d ? { ...d, primary: p } : d))}
            viewerIsAdmin={viewerIsAdmin}
            hidePrimary={!!hiddenPrimary}
            blockOf={(position, centerId) =>
              chipState({
                position,
                centerId,
                grid,
                viewerIsAdmin,
                hasLogin: !!persona.profileId,
                canEditCenter: viewerIsAdmin || editable.has(centerId),
              })
            }
          />
          {centersOf(grid).length === 0 && !grid.admin && <p className="text-xs text-warning-foreground">{t("noneAtAll")}</p>}
        </>
      )}
    </div>
  );
}
