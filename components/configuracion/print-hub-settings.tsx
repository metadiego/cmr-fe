"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon } from "@hugeicons/core-free-icons";

import { getCentroPreferences, updateCentroPreferences } from "@/lib/api/preferences";
import { apiErrorMessage } from "@/lib/api/errors";
import type { SobreDeCapa } from "@/lib/theme/mezclar-capa";
import { buildHubRequestUrl, type PrintHubTarget } from "@/lib/print/hub-target";
import { sendToHub, testTicketToEscPos } from "@/lib/print/hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  centerId: string;
  centerName: string;
  initial: PrintHubTarget | undefined;
}

// Per-center backup print destination: the shared hub URL plus THIS center's printer (host, port,
// queue). Saved as `printHub` in the center's preferences layer, merged into the free-form envelope
// so the theme and business settings that share it stay untouched. Mount with key={centerId}.
export function PrintHubSettings({ centerId, centerName, initial }: Props) {
  const t = useTranslations("aparienciaCorporativa");
  const tReceipt = useTranslations("receipt");
  const [form, setForm] = React.useState({
    url: initial?.url ?? "",
    printerHost: initial?.printerHost ?? "",
    printerPort: String(initial?.printerPort ?? "631"),
    printerQueue: initial?.printerQueue ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const requestUrl = buildHubRequestUrl(form);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const current: SobreDeCapa = { ...(await getCentroPreferences(centerId)) };
      delete current.impresionHub;
      const target: PrintHubTarget = {
        url: form.url.trim(),
        printerHost: form.printerHost.trim(),
        printerPort: form.printerPort.trim(),
        printerQueue: form.printerQueue.trim(),
      };
      if (Object.values(target).some((v) => v)) current.printHub = target;
      else delete current.printHub;
      await updateCentroPreferences(centerId, current);
      toast.success(t("hubSaved"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!requestUrl) {
      toast.error(t("hubIncomplete"));
      return;
    }
    setTesting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
      await sendToHub(requestUrl, testTicketToEscPos([tReceipt("hubTestTitle"), centerName, form.printerQueue, stamp]));
      toast.success(t("hubTestSent"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mt-6 space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={PrinterIcon} className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-medium">{t("hubLabel")}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{t("hubHint")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="ph-url">{t("hubUrl")}</Label>
        <Input id="ph-url" value={form.url} onChange={set("url")} placeholder={t("hubPlaceholder")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="ph-host">{t("printerHost")}</Label>
          <Input id="ph-host" value={form.printerHost} onChange={set("printerHost")} placeholder={t("printerHostPlaceholder")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ph-port">{t("printerPort")}</Label>
          <Input id="ph-port" inputMode="numeric" value={form.printerPort} onChange={set("printerPort")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ph-queue">{t("printerQueue")}</Label>
          <Input id="ph-queue" value={form.printerQueue} onChange={set("printerQueue")} placeholder={t("printerQueuePlaceholder")} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? t("saving") : t("hubSave")}
        </Button>
        <Button size="sm" variant="outline" onClick={test} disabled={testing || !requestUrl}>
          {testing ? t("saving") : t("hubTest")}
        </Button>
      </div>
    </div>
  );
}
