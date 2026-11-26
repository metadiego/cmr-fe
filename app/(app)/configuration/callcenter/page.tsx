"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import {
  listCallcenterChannels,
  createCallcenterChannel,
  updateCallcenterChannel,
  getCallcenterSettings,
  updateCallcenterSettings,
  type CallcenterChannel,
} from "@/lib/api/callcenter";
import { isValidDayRange, isValidHHMM, isValidLagAlertMinutes, WEEKDAYS } from "@/lib/comunicaciones/callcenter-settings-form";
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
import { TimePicker } from "@/components/ui/time-picker";
import { FormSheet } from "@/components/kit/form-sheet";
import { FormFooter } from "@/components/kit/form-footer";
import { Field } from "@/components/kit/field";
import { useSubmit } from "@/components/kit/use-submit";

// Admin for the Call Center's own catalogue (cmr-be #717/#718, handoff-callcenter-en-comunicaciones):
// which number belongs to which marketing channel, and the center's hours/lag-alert threshold the
// dashboard's push-health banner uses. callcenter.admin, PER CENTER (an exception to the dashboard's
// combined "un solo call center" reads — these are configured per clinic).
export default function CallcenterConfigPage() {
  const t = useTranslations("callcenterConfig");
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
    <ConfigGuard permiso="callcenter.admin">
      <PageContainer>
        <PageHeader title={t("title")} description={t("help")} />
        {gate.centro && (
          <>
            <ChannelsPanel centro={gate.centro} />
            <SettingsPanel centro={gate.centro} />
          </>
        )}
      </PageContainer>
    </ConfigGuard>
  );
}

function ChannelsPanel({ centro }: { centro: string }) {
  const t = useTranslations("callcenterConfig");
  const { state, reload } = useResource<CallcenterChannel[]>(() => listCallcenterChannels(centro), [centro]);
  const [editing, setEditing] = React.useState<CallcenterChannel | "new" | null>(null);
  const channels = state.kind === "ok" ? state.data : [];

  return (
    <>
      <Panel
        title={t("channelsTitle")}
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("newChannel")}
          </Button>
        }
      >
        {state.kind === "loading" && <LoadingPanel rows={3} />}
        {state.kind === "fail" && <ErrorState message={state.message} />}
        {state.kind === "ok" && channels.length === 0 && <EmptyState>{t("channelsEmpty")}</EmptyState>}
        {channels.length > 0 && (
          <div className="divide-y">
            {channels.map((c) => (
              <ChannelRow key={c.id} channel={c} centro={centro} onEdit={() => setEditing(c)} onChanged={reload} />
            ))}
          </div>
        )}
      </Panel>

      {editing && (
        <ChannelFormSheet
          channel={editing === "new" ? null : editing}
          centro={centro}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function ChannelRow({
  channel,
  centro,
  onEdit,
  onChanged,
}: {
  channel: CallcenterChannel;
  centro: string;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("callcenterConfig");
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);

  async function toggleActive(v: boolean) {
    setBusy(true);
    try {
      await updateCallcenterChannel(channel.id, { active: v }, centro);
      toast.success(t("channelUpdated"));
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{channel.number}</p>
        <p className="truncate text-xs text-muted-foreground">
          {t.has(`channelName.${channel.channel}`) ? t(`channelName.${channel.channel}`) : channel.channel}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onEdit}>{t("edit")}</Button>
      <Switch checked={channel.active} disabled={busy} onCheckedChange={toggleActive} aria-label={t("active")} />
    </div>
  );
}

function ChannelFormSheet({
  channel,
  centro,
  onClose,
  onSaved,
}: {
  channel: CallcenterChannel | null;
  centro: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("callcenterConfig");
  const [number, setNumber] = React.useState(channel?.number ?? "");
  const [channelValue, setChannelValue] = React.useState(channel?.channel ?? "facebook");
  const [labelKey, setLabelKey] = React.useState(channel?.labelKey ?? "");

  const missing = missingFields([
    [t("number"), !!number.trim()],
    [t("channelValue"), !!channelValue.trim()],
  ]);

  const { submitting, submit } = useSubmit(
    async () => {
      if (channel) {
        await updateCallcenterChannel(channel.id, { number: number.trim(), channel: channelValue.trim(), labelKey: labelKey.trim() || undefined }, centro);
      } else {
        await createCallcenterChannel({ number: number.trim(), channel: channelValue.trim(), labelKey: labelKey.trim() || undefined }, centro);
      }
    },
    { successMessage: channel ? t("channelUpdated") : t("channelCreated"), onSuccess: onSaved },
  );

  return (
    <FormSheet open onOpenChange={(v) => !v && onClose()} size="sm" title={channel ? t("editChannel") : t("newChannel")} missing={missing} submitting={submitting} onSubmit={() => submit()}>
      <Field label={t("number")} htmlFor="cc-ch-number" required>
        <Input id="cc-ch-number" value={number} onChange={(e) => setNumber(e.target.value)} />
      </Field>
      <Field label={t("channelValue")} htmlFor="cc-ch-channel" hint={t("channelValueHint")} required>
        <Input id="cc-ch-channel" value={channelValue} onChange={(e) => setChannelValue(e.target.value)} />
      </Field>
      <Field label={t("labelKeyOptional")} htmlFor="cc-ch-labelkey">
        <Input id="cc-ch-labelkey" value={labelKey} onChange={(e) => setLabelKey(e.target.value)} />
      </Field>
    </FormSheet>
  );
}

function SettingsPanel({ centro }: { centro: string }) {
  const { state, refresh } = useResource(() => getCallcenterSettings(centro), [centro]);

  if (state.kind === "loading") return <LoadingPanel rows={3} />;
  if (state.kind === "fail") return <ErrorState message={state.message} />;
  if (state.kind !== "ok") return null;

  return <SettingsForm centro={centro} settings={state.data} onSaved={refresh} />;
}

function SettingsForm({
  centro,
  settings,
  onSaved,
}: {
  centro: string;
  settings: { timeZone: string; hours: { days: number[]; start: string; end: string }; lagAlertMinutes: number };
  onSaved: () => void;
}) {
  const t = useTranslations("callcenterConfig");
  const [days, setDays] = React.useState<number[]>(settings.hours.days);
  const [start, setStart] = React.useState(settings.hours.start);
  const [end, setEnd] = React.useState(settings.hours.end);
  const [lagAlertMinutes, setLagAlertMinutes] = React.useState(String(settings.lagAlertMinutes));
  const [timeZone, setTimeZone] = React.useState(settings.timeZone);

  function toggleDay(d: number) {
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort((a, b) => a - b)));
  }

  const lagN = Number(lagAlertMinutes);
  const missing = missingFields([
    [t("hours"), days.length > 0],
    [t("timeZone"), !!timeZone.trim()],
  ]);
  const invalidRange = !isValidDayRange(start, end);
  const invalidLag = !isValidLagAlertMinutes(lagN);
  const reason = invalidRange ? t("rangeInvalid") : invalidLag ? t("lagInvalid") : null;
  const blocked = invalidRange || invalidLag;

  const { submitting, submit } = useSubmit(
    async () => {
      await updateCallcenterSettings(centro, { hours: { days, start, end }, lagAlertMinutes: lagN, timeZone: timeZone.trim() });
    },
    { successMessage: t("settingsSaved"), onSuccess: onSaved },
  );

  return (
    <Panel title={t("settingsTitle")}>
      <div className="space-y-4 p-5">
        <Field label={t("hours")}>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => toggleDay(w.value)}
                className={
                  "rounded-md border px-2.5 py-1.5 text-xs font-medium " +
                  (days.includes(w.value) ? "border-primary bg-primary/10" : "hover:bg-muted")
                }
              >
                {t(`weekday.${w.labelKey}`)}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("startHour")} htmlFor="cc-start" error={!isValidHHMM(start) ? t("timeInvalid") : null}>
            <TimePicker id="cc-start" value={start} onChange={setStart} aria-invalid={!isValidHHMM(start)} />
          </Field>
          <Field label={t("endHour")} htmlFor="cc-end" error={!isValidHHMM(end) ? t("timeInvalid") : null}>
            <TimePicker id="cc-end" value={end} onChange={setEnd} aria-invalid={!isValidHHMM(end)} />
          </Field>
        </div>

        <Field label={t("lagAlertMinutes")} htmlFor="cc-lag" hint={t("lagAlertMinutesHint")}>
          <Input id="cc-lag" type="number" min={5} max={720} value={lagAlertMinutes} aria-invalid={invalidLag} onChange={(e) => setLagAlertMinutes(e.target.value)} />
        </Field>

        <Field label={t("timeZone")} htmlFor="cc-tz" hint={t("timeZoneHint")} required>
          <Input id="cc-tz" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
        </Field>

        <FormFooter primary={{ label: t("save"), onClick: () => submit() }} missing={missing} reason={reason} blocked={blocked} submitting={submitting} />
      </div>
    </Panel>
  );
}
