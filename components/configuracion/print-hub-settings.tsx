"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon } from "@hugeicons/core-free-icons";

import { getCentroPreferences, updateCentroPreferences } from "@/lib/api/preferences";
import { apiErrorMessage } from "@/lib/api/errors";
import type { SobreDeCapa } from "@/lib/theme/mezclar-capa";
import {
  DEFAULT_PORTS,
  buildHubDiscoverUrl,
  buildHubRequestUrl,
  hubOrigin,
  type HubDiscovery,
  type PrintHubProtocol,
  type PrintHubTarget,
} from "@/lib/print/hub-target";
import { sendToHub, testTicketToEscPos } from "@/lib/print/hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  centerId: string;
  centerName: string;
  initial: PrintHubTarget | undefined;
}

type Link = "checking" | "ok" | "fail";
type Discovery = { kind: "idle" } | { kind: "busy" } | { kind: "done"; value: HubDiscovery } | { kind: "fail"; message: string };

// Per-center backup print destination: the shared hub URL plus THIS center's printer. The screen does
// what used to be manual: checks the browser can reach the hub (and links to accept its certificate),
// detects the system of the machine sharing the printer and lists its printers, and prints a test.
// Saved as `printHub` in the center's preferences layer, merged so the rest of the envelope stays.
// Mount with key={centerId}.
export function PrintHubSettings({ centerId, centerName, initial }: Props) {
  const t = useTranslations("aparienciaCorporativa");
  const tReceipt = useTranslations("receipt");
  const [form, setForm] = React.useState({
    url: initial?.url ?? "",
    protocol: (initial?.protocol ?? "ipp") as PrintHubProtocol,
    printerHost: initial?.printerHost ?? "",
    printerPort: String(initial?.printerPort ?? DEFAULT_PORTS.ipp),
    printerQueue: initial?.printerQueue ?? "",
  });
  const [link, setLink] = React.useState<Link>("checking");
  const [discovery, setDiscovery] = React.useState<Discovery>({ kind: "idle" });
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const origin = hubOrigin(form.url);
  const requestUrl = buildHubRequestUrl(form);

  const set = (k: "url" | "printerHost" | "printerPort" | "printerQueue") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // The browser either reaches the hub or it does not; with a self-signed certificate "does not" almost
  // always means this browser has not accepted it yet. The hub answers GET / with CORS, so a plain
  // fetch tells the two apart from a bad URL only by the link the admin is offered.
  const probe = React.useCallback(
    (): Promise<Link> =>
      origin
        ? fetch(origin + "/", { cache: "no-store" }).then((r) => (r.ok ? "ok" : "fail"), () => "fail")
        : Promise.resolve("fail"),
    [origin],
  );

  async function checkLink() {
    setLink("checking");
    setLink(await probe());
  }

  // Same pattern as the rest of this screen: the effect only launches the read and writes state in
  // the callback, guarded in case the URL changes before it answers.
  React.useEffect(() => {
    let active = true;
    probe().then((r) => active && setLink(r));
    return () => {
      active = false;
    };
  }, [probe]);

  async function detect() {
    const url = buildHubDiscoverUrl(form.url, form.printerHost);
    if (!url) return;
    setDiscovery({ kind: "busy" });
    try {
      const res = await fetch(url, { cache: "no-store" });
      const value = (await res.json()) as HubDiscovery & { error?: string };
      if (!res.ok) throw new Error(value.error ?? `hub ${res.status}`);
      setDiscovery({ kind: "done", value });
      if (value.protocol && value.port) {
        const protocol = value.protocol;
        setForm((f) => ({
          ...f,
          protocol,
          printerPort: String(value.port),
          printerQueue: value.printers.includes(f.printerQueue) ? f.printerQueue : value.printers.length === 1 ? value.printers[0] : f.printerQueue,
        }));
      }
    } catch (e) {
      setDiscovery({ kind: "fail", message: e instanceof Error ? e.message : String(e) });
      void checkLink();
    }
  }

  async function save() {
    setSaving(true);
    try {
      const current: SobreDeCapa = { ...(await getCentroPreferences(centerId)) };
      delete current.impresionHub;
      const target: PrintHubTarget = {
        url: form.url.trim(),
        protocol: form.protocol,
        printerHost: form.printerHost.trim(),
        printerPort: form.printerPort.trim(),
        printerQueue: form.printerQueue.trim(),
      };
      if (target.url || target.printerHost || target.printerQueue) current.printHub = target;
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
    if (!requestUrl) return toast.error(t("hubIncomplete"));
    setTesting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
      await sendToHub(requestUrl, testTicketToEscPos([tReceipt("hubTestTitle"), centerName, form.printerQueue, stamp]));
      toast.success(t("hubTestSent"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      void checkLink();
    } finally {
      setTesting(false);
    }
  }

  const found = discovery.kind === "done" ? discovery.value : null;

  return (
    <div className="mt-6 space-y-4 border-t pt-4">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={PrinterIcon} className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-medium">{t("hubLabel")}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{t("hubHint")}</p>

      {/* 1. Hub + link status */}
      <div className="space-y-1.5">
        <Label htmlFor="ph-url">{t("hubUrl")}</Label>
        <Input id="ph-url" value={form.url} onChange={set("url")} onBlur={() => void checkLink()} placeholder={t("hubPlaceholder")} />
        {origin && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2 text-xs",
              link === "ok" && "bg-success/10 text-success",
              link === "fail" && "bg-warning/10 text-foreground",
              link === "checking" && "bg-muted text-muted-foreground",
            )}
            role="status"
          >
            <span className="font-medium">
              {link === "ok" ? t("hubLinkOk") : link === "fail" ? t("hubLinkFail") : t("hubLinkChecking")}
            </span>
            {link === "fail" && (
              <>
                <span>{t("hubLinkFailHelp")}</span>
                <a href={origin} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                  {t("hubAcceptCert")}
                </a>
                <button type="button" onClick={() => void checkLink()} className="font-medium underline underline-offset-2">
                  {t("hubRecheck")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. Machine that shares the printer → detect */}
      <div className="space-y-1.5">
        <Label htmlFor="ph-host">{t("printerHost")}</Label>
        <div className="flex gap-2">
          <Input id="ph-host" value={form.printerHost} onChange={set("printerHost")} placeholder={t("printerHostPlaceholder")} />
          <Button
            type="button"
            variant="outline"
            onClick={detect}
            disabled={discovery.kind === "busy" || !buildHubDiscoverUrl(form.url, form.printerHost)}
          >
            {discovery.kind === "busy" ? t("hubDetecting") : t("hubDetect")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("printerHostHelp")}</p>
        {discovery.kind === "fail" && <p className="text-xs text-destructive">{discovery.message}</p>}
        {found && (
          <div className="space-y-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <p>
              <span className="font-medium">
                {found.system === "windows" ? t("hubSystemWindows") : found.system === "linux-mac" ? t("hubSystemLinuxMac") : t("hubSystemNone")}
              </span>
              {found.port ? ` · ${t("printerPort")} ${found.port}` : ""}
            </p>
            {found.printers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {found.printers.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, printerQueue: p }))}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5",
                      form.printerQueue === p ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                {found.error && /ACCESS_DENIED|LOGON_FAILURE/.test(found.error)
                  ? t("hubNeedsWindowsLogin")
                  : found.system
                    ? t("hubNoSharedPrinters")
                    : found.error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Port + queue, filled by detect, still editable */}
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="ph-port">{t("printerPort")}</Label>
          <Input id="ph-port" inputMode="numeric" value={form.printerPort} onChange={set("printerPort")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ph-queue">{form.protocol === "smb" ? t("printerShare") : t("printerQueue")}</Label>
          <Input id="ph-queue" value={form.printerQueue} onChange={set("printerQueue")} placeholder={t("printerQueuePlaceholder")} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {form.protocol === "smb" ? t("printerHelpWindows") : t("printerHelpLinuxMac")}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? t("saving") : t("hubSave")}
        </Button>
        <Button size="sm" variant="outline" onClick={test} disabled={testing || !requestUrl}>
          {testing ? t("hubTesting") : t("hubTest")}
        </Button>
      </div>
    </div>
  );
}
