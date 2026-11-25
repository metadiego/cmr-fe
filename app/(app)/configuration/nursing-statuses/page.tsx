"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import {
  getNurseStatusTipos,
  createNurseStatusTipo,
  updateNurseStatusTipo,
  type NurseStatusTipo,
} from "@/lib/api/frontdesk";
import { durationOptionsHasInvalidToken, labelKeyFor, parseDurationOptions, slugify } from "@/lib/frontdesk/nurse-status-tipo-form";
import { toastError } from "@/lib/api/errors";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { ConfigGuard } from "@/components/configuracion/config-guard";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { Panel, EmptyState, ErrorState, LoadingPanel } from "@/components/kit/panel";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormSheet } from "@/components/kit/form-sheet";
import { Field } from "@/components/kit/field";
import { useSubmit } from "@/components/kit/use-submit";

// Admin del catálogo `nurse_status_tipos` (owner, via handoff cmr-be-42, 25-nov-2026): hasta ahora
// un estatus nuevo (Enfermería, components/frontdesk/nurse-status-button.tsx) solo lo podía dar de
// alta alguien con acceso al endpoint. Esta pantalla lo abre al dueño: nombre + color + si cuenta
// como "disponible" + duraciones opcionales (p. ej. Descanso: 10/15/30/45/60 min). `slug`/`labelKey`
// los arma el FE del nombre (la API los exige pero no los genera, y no tiene sentido pedírselos a
// quien solo quiere escribir "Descanso"); `slug` queda fijo una vez creado. Sin DELETE — un tipo ya
// usado en el historial se retira con `active:false`, igual que el catálogo hermano de prioridades
// (components/.../priority-flags/page.tsx), que esta pantalla sigue de cerca.
export default function NurseStatusTypesAdminPage() {
  const t = useTranslations("nurseStatusTypes");
  const gate = useCentroGate();
  const { state, reload } = useResource<NurseStatusTipo[]>(
    () => (gate.centro ? getNurseStatusTipos(gate.centro) : Promise.resolve([])),
    [gate.centro],
  );
  const [editing, setEditing] = React.useState<NurseStatusTipo | "new" | null>(null);
  const sorted = state.kind === "ok" ? [...state.data].sort((a, b) => a.sortOrder - b.sortOrder) : [];

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
    <ConfigGuard permiso="frontdesk.create">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("help")}
          actions={
            <Button size="sm" disabled={!gate.centro} onClick={() => setEditing("new")}>
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
              {t("new")}
            </Button>
          }
        />

        {(gate.cargando || state.kind === "loading") && <LoadingPanel rows={4} />}
        {!gate.cargando && state.kind === "fail" && <ErrorState message={state.message} />}
        {!gate.cargando && state.kind === "ok" && sorted.length === 0 && <EmptyState>{t("empty")}</EmptyState>}
        {sorted.length > 0 && (
          <Panel>
            <div className="divide-y">
              {sorted.map((n) => (
                <StatusRow key={n.id} tipo={n} centro={gate.centro} onEdit={() => setEditing(n)} onChanged={reload} />
              ))}
            </div>
          </Panel>
        )}

        {editing && gate.centro && (
          <StatusFormSheet
            tipo={editing === "new" ? null : editing}
            centro={gate.centro}
            existingSlugs={sorted.map((n) => n.slug)}
            nextSortOrder={sorted.length}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </PageContainer>
    </ConfigGuard>
  );
}

function StatusRow({
  tipo,
  centro,
  onEdit,
  onChanged,
}: {
  tipo: NurseStatusTipo;
  centro?: string;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("nurseStatusTypes");
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);
  const label = tRoot.has(tipo.labelKey) ? tRoot(tipo.labelKey) : tipo.name;

  async function toggleActive(v: boolean) {
    setBusy(true);
    try {
      await updateNurseStatusTipo(tipo.id, { active: v }, centro);
      toast.success(t("updated"));
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className="size-3 shrink-0 rounded-full border border-border/50"
        style={{ backgroundColor: tipo.color || "var(--muted-foreground)" }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tipo.countsAsAvailable ? t("countsAsAvailableYes") : t("countsAsAvailableNo")}
          {tipo.durationOptions && tipo.durationOptions.length > 0 && ` · ${t("durationsN", { list: tipo.durationOptions.join(", ") })}`}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onEdit}>{t("edit")}</Button>
      <Switch checked={tipo.active} disabled={busy} onCheckedChange={toggleActive} aria-label={t("active")} />
    </div>
  );
}

function StatusFormSheet({
  tipo,
  centro,
  existingSlugs,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  tipo: NurseStatusTipo | null;
  centro: string;
  existingSlugs: string[];
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("nurseStatusTypes");
  const [name, setName] = React.useState(tipo?.name ?? "");
  const [color, setColor] = React.useState(tipo?.color ?? "#2563eb");
  const [countsAsAvailable, setCountsAsAvailable] = React.useState(tipo?.countsAsAvailable ?? false);
  const [durationsText, setDurationsText] = React.useState((tipo?.durationOptions ?? []).join(", "));

  const slug = tipo?.slug ?? slugify(name);
  const slugTaken = !tipo && slug.length > 0 && existingSlugs.includes(slug);
  const durationsInvalid = durationOptionsHasInvalidToken(durationsText);

  const missing = missingFields([
    [t("name"), !!name.trim()],
  ]);
  const reason = slugTaken ? t("slugTaken") : durationsInvalid ? t("durationsInvalid") : null;
  const blocked = slugTaken || durationsInvalid;

  const { submitting, submit } = useSubmit(
    async () => {
      const durationOptions = parseDurationOptions(durationsText);
      if (tipo) {
        await updateNurseStatusTipo(
          tipo.id,
          {
            name: name.trim(),
            color: color.trim() || null,
            countsAsAvailable,
            durationOptions: durationOptions.length > 0 ? durationOptions : null,
          },
          centro,
        );
      } else {
        await createNurseStatusTipo(
          {
            slug,
            labelKey: labelKeyFor(slug),
            name: name.trim(),
            color: color.trim() || null,
            sortOrder: nextSortOrder,
            countsAsAvailable,
            durationOptions: durationOptions.length > 0 ? durationOptions : null,
          },
          centro,
        );
      }
    },
    { successMessage: tipo ? t("updated") : t("created"), onSuccess: onSaved },
  );

  return (
    <FormSheet
      open
      onOpenChange={(v) => !v && onClose()}
      size="sm"
      title={tipo ? t("edit") : t("new")}
      missing={missing}
      reason={reason}
      blocked={blocked}
      submitting={submitting}
      onSubmit={() => submit()}
    >
      <Field label={t("name")} htmlFor="nst-name" hint={!tipo ? t("slugPreview", { slug }) : undefined} required>
        <Input id="nst-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
      </Field>

      <Field label={t("color")} htmlFor="nst-color" hint={t("colorHint")}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={t("color")}
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2563eb"}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-10 shrink-0 cursor-pointer rounded-md border"
          />
          <Input id="nst-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#2563eb" className="font-mono" />
        </div>
      </Field>

      <Field label={t("durations")} htmlFor="nst-durations" hint={t("durationsHint")} error={durationsInvalid ? t("durationsInvalid") : null}>
        <Input
          id="nst-durations"
          value={durationsText}
          aria-invalid={durationsInvalid}
          onChange={(e) => setDurationsText(e.target.value)}
          placeholder="10, 15, 30, 45, 60"
        />
      </Field>

      <Field label={t("countsAsAvailable")} htmlFor="nst-counts" hint={t("countsAsAvailableHint")}>
        <Switch id="nst-counts" checked={countsAsAvailable} onCheckedChange={setCountsAsAvailable} aria-label={t("countsAsAvailable")} />
      </Field>
    </FormSheet>
  );
}
