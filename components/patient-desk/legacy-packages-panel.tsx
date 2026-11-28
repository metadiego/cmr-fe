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
// TEMPORARY, center-scoped correction window (the owner, tired of fixing these by hand, 28-nov-2026)
// for legacy-imported packages whose sessions came in miscounted. Invisible unless BOTH the center's
// window is open AND the viewer holds the permission — never a dead section for everyone else.
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
