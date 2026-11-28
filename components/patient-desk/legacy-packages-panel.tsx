"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getLegacyPackages, getLegacyPackagesWindow, type LegacyPackage } from "@/lib/api/legacy-packages";
import { useResource } from "@/hooks/use-resource";
import { useCanInCenter } from "@/hooks/use-can-in-center";
import { Button } from "@/components/ui/button";
import { Panel, RecordTable, Th, Td } from "@/components/kit/panel";
import { LegacyPackageCorrectDialog } from "@/components/patient-desk/legacy-package-correct-dialog";

// "Paquetes del legado" (handoff correccion-paquetes-del-legado, cmr-be PR #740, 28-nov-2026): a
// TEMPORARY, center-scoped correction tool — for when staff already suspects a specific package is
// miscounted, NOT a status board. `correctable` is a CAPABILITY (this package can be edited), never a
// signal that something is actually wrong — most legacy packages mid-treatment are perfectly normal
// (11/12, 1 pending is just a patient with one session left). Showing that list open by default, above
// the day's real work, read as "these all have problems" and blocked staff (owner, 28-nov-2026: "no le
// permite seguir con el trabajo"). Collapsed behind an explicit click; never auto-expanded.
export function LegacyPackagesPanel({
  patientId,
  centerId,
  onChanged,
}: {
  patientId: string;
  centerId?: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("legacyPackages");
  const canCorrect = useCanInCenter("frontdesk.legacy_packages.correct", centerId);
  const [correcting, setCorrecting] = React.useState<LegacyPackage | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  const windowRes = useResource(
    () => (centerId ? getLegacyPackagesWindow(centerId) : Promise.resolve(null)),
    [centerId],
  );
  const open = windowRes.state.kind === "ok" && windowRes.state.data?.open === true;

  const packagesRes = useResource<LegacyPackage[]>(
    () => (open ? getLegacyPackages(patientId, centerId) : Promise.resolve([])),
    [patientId, centerId, open],
  );
  const packages = packagesRes.state.kind === "ok" ? packagesRes.state.data : [];

  if (!canCorrect || !open || packages.length === 0) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {t("title")}
      </button>
    );
  }

  return (
    <>
      <Panel title={t("title")}>
        <RecordTable
          head={
            <>
              <Th>{t("product")}</Th>
              <Th right>{t("deliveredOfTotal")}</Th>
              <Th right>{t("pending")}</Th>
              <Th right>{t("correct")}</Th>
            </>
          }
        >
          {packages.map((p) => (
            <tr key={p.id}>
              <Td>
                <span className="font-medium">{p.productName}</span>
                {p.sku && <span className="ml-1.5 text-muted-foreground">· {p.sku}</span>}
              </Td>
              <Td className="text-right tabular-nums">{p.deliveredSessions}/{p.totalSessions}</Td>
              <Td className="text-right tabular-nums text-muted-foreground">{p.remaining}</Td>
              <Td className="text-right">
                {p.correctable && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setCorrecting(p)}>
                    {t("correct")}
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </RecordTable>
      </Panel>

      <LegacyPackageCorrectDialog
        paquete={correcting}
        centroId={centerId}
        onClose={() => setCorrecting(null)}
        onDone={() => {
          packagesRes.refresh();
          onChanged?.();
        }}
      />
    </>
  );
}
