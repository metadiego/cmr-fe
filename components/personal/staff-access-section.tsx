"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserAccountIcon } from "@hugeicons/core-free-icons";

import type { Personal } from "@/lib/api/personal";
import type { Position } from "@/lib/api/positions";
import type { Perfil } from "@/lib/api/profiles";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserAccessPanel } from "@/components/admin/user-access-panel";
import { StaffPositionsSection } from "@/components/personal/staff-positions-section";

// «Acceso al sistema» on the staff record (owner, 28-nov): everything about what the person can open, in
// one section — the login (status, email, «Accesos» = permission exceptions and menu preview, ⋮), then
// the full-access switch and the access roles per center. Roles only mean something with a login, so the
// grid shows for a login only; a record without one offers «Dar acceso», where the invite picks roles.
// Managing access is an administrator's call (cmr-be): others see the login, read-only.
export function StaffAccessSection({
  persona,
  profile,
  viewerIsAdmin,
  positions,
  positionsError,
  functionSlugs,
  centro,
  onProfileChanged,
  onGiveAccess,
}: {
  persona: Personal;
  /** The person's login, loaded for an admin. */
  profile: Perfil | undefined;
  viewerIsAdmin: boolean;
  positions: Position[];
  positionsError: string | null;
  functionSlugs: string[];
  centro?: string;
  onProfileChanged: () => void;
  onGiveAccess: () => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-0.5">
        <Label>{t("acceso")}</Label>
        <p className="text-xs text-muted-foreground">{tRoot("staffAccess.help")}</p>
      </div>

      {profile ? (
        <UserAccessPanel profile={profile} onChanged={onProfileChanged} />
      ) : persona.profileId ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <HugeiconsIcon icon={UserAccountIcon} className="size-4 text-success" />
          <span>{persona.email || t("conCuenta")}</span>
        </div>
      ) : viewerIsAdmin ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2">
          <span className="text-sm text-muted-foreground">{t("sinCuentaAyuda")}</span>
          <Button size="sm" onClick={onGiveAccess}>{t("darAcceso")}</Button>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">{tRoot("staffPositions.giveAccessNeedsAdmin")}</span>
      )}

      {viewerIsAdmin && persona.profileId && (
        <StaffPositionsSection
          persona={persona}
          catalog={positions}
          functionSlugs={functionSlugs}
          catalogError={positionsError}
          centro={centro}
          bare
        />
      )}
    </div>
  );
}
