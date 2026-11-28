"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getLegacyPackagesWindow, putLegacyPackagesWindow, type LegacyPackagesWindow } from "@/lib/api/legacy-packages";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { Panel, ErrorState, LoadingPanel } from "@/components/kit/panel";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { DatePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/kit/field";
import { FormFooter } from "@/components/kit/form-footer";
import { useSubmit } from "@/components/kit/use-submit";

// Window that lets Recepción/Enfermería/Gerente correct a legacy-imported package's own numbers from
// patient-desk (handoff correccion-paquetes-del-legado, cmr-be PR #740, 28-nov-2026) — the owner,
// tired of fixing these by hand, asked for a TEMPORARY, per-center door (about 30 days), never a
// permanent one. frontdesk.legacy_packages.configure, separate from the .correct permission the
// patient-desk panel itself checks.
export default function LegacyPackagesConfigPage() {
  const t = useTranslations("legacyPackagesConfig");
  const gate = useCentroGate();

  if (gate.sinCentro) {
    return <PageContainer className="text-center text-sm text-muted-foreground">{t("sinCentro")}</PageContainer>;
  }
  if (gate.necesitaPicker) {
    return (
      <PageContainer>
        <CentroPicker centros={gate.centros} onPick={gate.pick} />
      </PageContainer>
    );
  }

  return (
    <ConfigGuard permiso="frontdesk.legacy_packages.configure">
      <PageContainer>
        <PageHeader title={t("title")} description={t("help")} />
        {gate.centro && <WindowPanel centro={gate.centro} />}
      </PageContainer>
    </ConfigGuard>
  );
}

function WindowPanel({ centro }: { centro: string }) {
  const { state, refresh } = useResource<LegacyPackagesWindow>(() => getLegacyPackagesWindow(centro), [centro]);

  if (state.kind === "loading") return <LoadingPanel rows={2} />;
  if (state.kind === "fail") return <ErrorState message={state.message} />;
  if (state.kind !== "ok") return null;

  return <WindowForm centro={centro} data={state.data} onSaved={refresh} />;
}

function WindowForm({
  centro,
  data,
  onSaved,
}: {
  centro: string;
  data: LegacyPackagesWindow;
  onSaved: () => void;
}) {
  const t = useTranslations("legacyPackagesConfig");
  const [until, setUntil] = React.useState(data.until ?? "");

  const { submitting, submit } = useSubmit(
    async () => {
      await putLegacyPackagesWindow(centro, until.trim() || null);
    },
    { successMessage: t("saved"), onSuccess: onSaved },
  );

  const { submitting: closing, submit: close } = useSubmit(
    async () => {
      await putLegacyPackagesWindow(centro, null);
    },
    { successMessage: t("closed"), onSuccess: () => { setUntil(""); onSaved(); } },
  );

  const anyBusy = submitting || closing;

  return (
    <Panel title={t("windowTitle")}>
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted-foreground">
          {data.open ? t("statusOpen", { until: data.until ?? "" }) : t("statusClosed")}
        </p>
        <Field label={t("until")} htmlFor="legacy-pkg-until" hint={t("untilHint")}>
          <DatePicker id="legacy-pkg-until" value={until} onChange={setUntil} min={data.today} className="w-40" />
        </Field>
        <FormFooter
          primary={
            data.open
              ? [
                  { label: t("save"), onClick: () => submit(), busy: submitting },
                  { label: t("closeNow"), onClick: () => close(), variant: "outline", busy: closing },
                ]
              : { label: t("save"), onClick: () => submit(), busy: submitting }
          }
          missing={[]}
          submitting={anyBusy}
        />
      </div>
    </Panel>
  );
}
