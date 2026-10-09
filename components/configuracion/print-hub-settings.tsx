"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon } from "@hugeicons/core-free-icons";

import { deletePrintHub, getPrintHub, setPrintHub } from "@/lib/api/print-hub";
import { apiErrorLabel } from "@/lib/api/errors";
import {
  DEFAULT_PORTS,
  buildHubDiscoverUrl,
  buildHubRequestUrl,
  buildHubRequestUrls,
  hubOrigin,
  type HubDiscovery,
  type PrintHubProtocol,
} from "@/lib/print/hub-target";
import { sendToHubs, testTicketToEscPos } from "@/lib/print/hub";
import { PrintHubLogin } from "@/components/configuracion/print-hub-login";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Props {
  centerId: string;
  centerName: string;
}

type Link = "checking" | "ok" | "fail";
type Discovery = { kind: "idle" } | { kind: "busy" } | { kind: "done"; value: HubDiscovery } | { kind: "fail"; message: string };
interface Form {
  enabled: boolean;
  hubUrls: string[];
  protocol: PrintHubProtocol;
  printerHost: string;
  printerPort: string;
  printerQueue: string;
}

const EMPTY: Form = { enabled: true, hubUrls: [""], protocol: "ipp", printerHost: "", printerPort: String(DEFAULT_PORTS.ipp), printerQueue: "" };

// Is this browser able to reach the hub? With a self-signed certificate "no" almost always means it has
// not been accepted on this machine yet. The hub answers GET / with CORS.
const probe = (url: string): Promise<Link> => {
  const origin = hubOrigin(url);
  return origin ? fetch(origin + "/", { cache: "no-store" }).then((r) => (r.ok ? "ok" : "fail"), () => "fail") : Promise.resolve("fail");
};

// Per-center backup print configuration (BE /print-hubs). The screen does on sight what used to be
// manual: an ordered list of hubs (central first, then e.g. one on the printer's own machine so it keeps
// printing if the central one is down), whether this browser reaches each one plus the link to accept
// its certificate, Detect on the printer machine's IP, and a test print through the same cascade the
// invoice uses. Mount with key={centerId}.
export function PrintHubSettings({ centerId, centerName }: Props) {
  const t = useTranslations("aparienciaCorporativa");
  const tReceipt = useTranslations("receipt");
  const tRoot = useTranslations();
  const { can } = useCan();
  const canRead = can("print-hub.read") || can("*");
  const canEdit = can("print-hub.update") || can("*");
  const canDelete = can("print-hub.delete") || can("*");

  const [load, setLoad] = React.useState<"loading" | "ok" | "fail">("loading");
  const [exists, setExists] = React.useState(false);
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [links, setLinks] = React.useState<Record<string, Link>>({});
  const [discovery, setDiscovery] = React.useState<Discovery>({ kind: "idle" });
  const [busy, setBusy] = React.useState<"save" | "test" | "delete" | null>(null);

  React.useEffect(() => {
    if (!canRead) return;
    let active = true;
    getPrintHub(centerId)
      .then((h) => {
        if (!active) return;
        setExists(!!h);
        if (h) {
          setForm({
            enabled: h.enabled,
            hubUrls: h.hubUrls.length ? h.hubUrls : [""],
            protocol: (h.protocol as PrintHubProtocol) || "ipp",
            printerHost: h.printerHost ?? "",
            printerPort: String(h.printerPort ?? DEFAULT_PORTS.ipp),
            printerQueue: h.printerQueue ?? "",
          });
        }
        setLoad("ok");
      })
      .catch(() => active && setLoad("fail"));
    return () => {
      active = false;
    };
  }, [centerId, canRead]);

  const hubsKey = form.hubUrls.join("\n");
  React.useEffect(() => {
    let active = true;
    for (const u of hubsKey.split("\n").filter(Boolean)) {
      probe(u).then((r) => active && setLinks((l) => ({ ...l, [u]: r })));
    }
    return () => {
      active = false;
    };
  }, [hubsKey]);

  async function recheck(u: string) {
    setLinks((l) => ({ ...l, [u]: "checking" }));
    const r = await probe(u);
    setLinks((l) => ({ ...l, [u]: r }));
  }

  if (!canRead) return null;

  const setField = (k: "printerHost" | "printerPort" | "printerQueue") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setHub = (i: number, v: string) => setForm((f) => ({ ...f, hubUrls: f.hubUrls.map((u, j) => (j === i ? v : u)) }));
  const moveHub = (i: number, d: -1 | 1) =>
    setForm((f) => {
      const hubUrls = [...f.hubUrls];
      [hubUrls[i], hubUrls[i + d]] = [hubUrls[i + d], hubUrls[i]];
      return { ...f, hubUrls };
    });
  const removeHub = (i: number) => setForm((f) => ({ ...f, hubUrls: f.hubUrls.filter((_, j) => j !== i) }));

  const cleanHubs = form.hubUrls.map((u) => u.trim()).filter(Boolean);
  const requestUrls = buildHubRequestUrls({ ...form, hubUrls: cleanHubs, enabled: true });
  const discoverHub = cleanHubs.find((u) => links[u] === "ok") ?? cleanHubs[0];

  async function detect() {
    const url = buildHubDiscoverUrl(discoverHub, form.printerHost);
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
    }
  }

  async function save() {
    setBusy("save");
    try {
      await setPrintHub(centerId, {
        enabled: form.enabled,
        hubUrls: cleanHubs,
        protocol: form.protocol,
        printerHost: form.printerHost.trim() || undefined,
        printerPort: form.printerPort.trim() ? Number(form.printerPort) : undefined,
        printerQueue: form.printerQueue.trim() || undefined,
      });
      setExists(true);
      toast.success(t("hubSaved"));
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    if (requestUrls.length === 0) return toast.error(t("hubIncomplete"));
    setBusy("test");
    try {
      const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
      const i = await sendToHubs(requestUrls, testTicketToEscPos([tReceipt("hubTestTitle"), centerName, form.printerQueue, stamp]));
      toast.success(t("hubTestSentVia", { hub: new URL(requestUrls[i]).host }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(t("hubRemoveConfirm", { center: centerName }))) return;
    setBusy("delete");
    try {
      await deletePrintHub(centerId);
      setExists(false);
      setForm(EMPTY);
      setDiscovery({ kind: "idle" });
      toast.success(t("hubRemoved"));
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(null);
    }
  }

  const found = discovery.kind === "done" ? discovery.value : null;

  return (
    <div className="mt-6 space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={PrinterIcon} className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-medium">{t("hubLabel")}</h3>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} disabled={!canEdit} />
          {t("hubEnabled")}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{t("hubHint")}</p>
      {load === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {load === "fail" && <p className="text-sm text-destructive">{t("hubLoadFail")}</p>}

      {load === "ok" && (
        <fieldset disabled={!canEdit} className="space-y-4">
          {/* 1. Hubs in order, each with whether this browser reaches it */}
          <div className="space-y-2">
            <Label>{t("hubUrls")}</Label>
            <p className="text-xs text-muted-foreground">{t("hubUrlsHelp")}</p>
            {form.hubUrls.map((u, i) => {
              const link = u.trim() ? (links[u.trim()] ?? "checking") : null;
              const origin = hubOrigin(u);
              return (
                <div key={i} className="space-y-1">
                  <div className="flex gap-2">
                    <span className="mt-2 w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                    <Input value={u} onChange={(e) => setHub(i, e.target.value)} placeholder={i === 0 ? t("hubPlaceholder") : t("hubLocalPlaceholder")} aria-label={`${t("hubUrls")} ${i + 1}`} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveHub(i, -1)} disabled={i === 0} aria-label={t("hubMoveUp")}>↑</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveHub(i, 1)} disabled={i === form.hubUrls.length - 1} aria-label={t("hubMoveDown")}>↓</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeHub(i)} disabled={form.hubUrls.length === 1} aria-label={t("hubRemoveUrl")}>×</Button>
                  </div>
                  {link && origin && (
                    <div
                      className={cn(
                        "ml-7 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-1.5 text-xs",
                        link === "ok" && "bg-success/10 text-success",
                        link === "fail" && "bg-warning/10 text-foreground",
                        link === "checking" && "bg-muted text-muted-foreground",
                      )}
                      role="status"
                    >
                      <span className="font-medium">{link === "ok" ? t("hubLinkOk") : link === "fail" ? t("hubLinkFail") : t("hubLinkChecking")}</span>
                      {link === "fail" && (
                        <>
                          <span>{t("hubLinkFailHelp")}</span>
                          <a href={origin} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">{t("hubAcceptCert")}</a>
                          <button type="button" onClick={() => void recheck(u.trim())} className="font-medium underline underline-offset-2">{t("hubRecheck")}</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, hubUrls: [...f.hubUrls, ""] }))}>
              {t("hubAddUrl")}
            </Button>
          </div>

          {/* 2. Machine that shares the printer → detect */}
          <div className="space-y-1.5">
            <Label htmlFor="ph-host">{t("printerHost")}</Label>
            <div className="flex gap-2">
              <Input id="ph-host" value={form.printerHost} onChange={setField("printerHost")} placeholder={t("printerHostPlaceholder")} />
              <Button type="button" variant="outline" onClick={detect} disabled={discovery.kind === "busy" || !buildHubDiscoverUrl(discoverHub, form.printerHost)}>
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
                        className={cn("rounded-full border px-2.5 py-0.5", form.printerQueue === p ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                ) : found.needsLogin ? null : (
                  <p className="text-muted-foreground">{found.system ? t("hubNoSharedPrinters") : found.error}</p>
                )}
                {/* Windows PC: its login is handed to the hub from here (stored only on the hub). */}
                {found.system === "windows" && canEdit && (
                  <PrintHubLogin
                    key={`${found.host}-${!!found.needsLogin}`}
                    hubUrl={discoverHub}
                    host={found.host}
                    centerId={centerId}
                    required={!!found.needsLogin}
                    onSaved={(printers) => setDiscovery({ kind: "done", value: { ...found, printers, needsLogin: false, error: null } })}
                  />
                )}
              </div>
            )}
          </div>

          {/* 3. Port + queue, filled by Detect, still editable */}
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="ph-port">{t("printerPort")}</Label>
              <Input id="ph-port" inputMode="numeric" value={form.printerPort} onChange={setField("printerPort")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph-queue">{form.protocol === "smb" ? t("printerShare") : t("printerQueue")}</Label>
              <Input id="ph-queue" value={form.printerQueue} onChange={setField("printerQueue")} placeholder={t("printerQueuePlaceholder")} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{form.protocol === "smb" ? t("printerHelpWindows") : t("printerHelpLinuxMac")}</p>
        </fieldset>
      )}

      {load === "ok" && (
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" onClick={save} disabled={busy !== null || (form.enabled && !buildHubRequestUrl(cleanHubs[0], form))}>
              {busy === "save" ? t("saving") : t("hubSave")}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={test} disabled={busy !== null || requestUrls.length === 0}>
            {busy === "test" ? t("hubTesting") : t("hubTest")}
          </Button>
          {canDelete && exists && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={busy !== null}>
              {busy === "delete" ? t("saving") : t("hubRemove")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
