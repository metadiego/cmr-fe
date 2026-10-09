"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createPrinter, deletePrinter, updatePrinter, type CenterPrinter } from "@/lib/api/print-hub";
import { apiErrorLabel } from "@/lib/api/errors";
import { DEFAULT_PORTS, buildHubDiscoverUrl, buildHubRequestUrls, type HubDiscovery, type PrintHubProtocol } from "@/lib/print/hub-target";
import { sendToHubs, testTicketToEscPos } from "@/lib/print/hub";
import { PrintHubLogin } from "@/components/configuracion/print-hub-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Discovery = { kind: "idle" } | { kind: "busy" } | { kind: "done"; value: HubDiscovery } | { kind: "fail"; message: string };

interface Form {
  name: string;
  protocol: PrintHubProtocol;
  printerHost: string;
  printerPort: string;
  printerQueue: string;
}

const fromPrinter = (p: CenterPrinter | null): Form =>
  p
    ? { name: p.name, protocol: p.protocol, printerHost: p.printerHost ?? "", printerPort: String(p.printerPort), printerQueue: p.printerQueue }
    : { name: "", protocol: "ipp", printerHost: "", printerPort: String(DEFAULT_PORTS.ipp), printerQueue: "" };

interface Props {
  centerId: string;
  centerName: string;
  // null = a new printer not saved yet.
  printer: CenterPrinter | null;
  // The center's hubs in order (for the test print) and the first one this browser reaches (for Detect).
  hubUrls: string[];
  discoverHub: string | undefined;
  canEdit: boolean;
  canDelete: boolean;
  onSaved: (p: CenterPrinter) => void;
  onDeleted: () => void;
}

// One of the center's receipt printers: its name (what each machine picks in the receipt modal),
// the machine that shares it (Detect asks the hub its system and shared printers, and a Windows PC's
// login is handed to the hub from here), the queue, and a test print through the same hubs the
// invoice uses.
export function PrintHubPrinterCard({ centerId, centerName, printer, hubUrls, discoverHub, canEdit, canDelete, onSaved, onDeleted }: Props) {
  const t = useTranslations("aparienciaCorporativa");
  const tReceipt = useTranslations("receipt");
  const tRoot = useTranslations();
  const [form, setForm] = React.useState<Form>(() => fromPrinter(printer));
  const [discovery, setDiscovery] = React.useState<Discovery>({ kind: "idle" });
  const [busy, setBusy] = React.useState<"save" | "test" | "delete" | null>(null);

  const setField = (k: keyof Omit<Form, "protocol">) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const requestUrls = buildHubRequestUrls({ enabled: true, hubUrls, ...form });
  const complete = !!form.name.trim() && !!form.printerHost.trim() && !!form.printerQueue.trim() && /^\d+$/.test(form.printerPort.trim());
  const dirty = JSON.stringify(form) !== JSON.stringify(fromPrinter(printer));

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
    const body = {
      name: form.name.trim(),
      protocol: form.protocol,
      printerHost: form.printerHost.trim(),
      printerPort: Number(form.printerPort),
      printerQueue: form.printerQueue.trim(),
    };
    try {
      const saved = printer ? await updatePrinter(centerId, printer.id, body) : await createPrinter(centerId, body);
      toast.success(t("printerSaved", { name: saved.name }));
      onSaved(saved);
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!printer) return onDeleted();
    if (!window.confirm(t("printerRemoveConfirm", { name: printer.name }))) return;
    setBusy("delete");
    try {
      await deletePrinter(centerId, printer.id);
      toast.success(t("printerRemoved", { name: printer.name }));
      onDeleted();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
      setBusy(null);
    }
  }

  async function test() {
    if (requestUrls.length === 0) return toast.error(t("hubIncomplete"));
    setBusy("test");
    try {
      const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
      const i = await sendToHubs(requestUrls, testTicketToEscPos([tReceipt("hubTestTitle"), `${centerName} · ${form.name}`, form.printerQueue, stamp]));
      toast.success(t("hubTestSentVia", { hub: new URL(requestUrls[i]).host }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const found = discovery.kind === "done" ? discovery.value : null;
  const id = printer?.id ?? "new";

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <fieldset disabled={!canEdit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`pn-${id}`}>{t("printerName")}</Label>
          <Input id={`pn-${id}`} value={form.name} onChange={setField("name")} placeholder={t("printerNamePlaceholder")} className="max-w-xs font-medium" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`ph-${id}`}>{t("printerHost")}</Label>
          <div className="flex gap-2">
            <Input id={`ph-${id}`} value={form.printerHost} onChange={setField("printerHost")} placeholder={t("printerHostPlaceholder")} />
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

        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor={`pp-${id}`}>{t("printerPort")}</Label>
            <Input id={`pp-${id}`} inputMode="numeric" value={form.printerPort} onChange={setField("printerPort")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`pq-${id}`}>{form.protocol === "smb" ? t("printerShare") : t("printerQueue")}</Label>
            <Input id={`pq-${id}`} value={form.printerQueue} onChange={setField("printerQueue")} placeholder={t("printerQueuePlaceholder")} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{form.protocol === "smb" ? t("printerHelpWindows") : t("printerHelpLinuxMac")}</p>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button size="sm" onClick={save} disabled={busy !== null || !complete || (!!printer && !dirty)}>
            {busy === "save" ? t("saving") : printer ? t("printerSave") : t("printerCreate")}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={test} disabled={busy !== null || requestUrls.length === 0}>
          {busy === "test" ? t("hubTesting") : t("hubTest")}
        </Button>
        {(canDelete || !printer) && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={busy !== null}>
            {busy === "delete" ? t("saving") : printer ? t("printerRemove") : t("printerDiscard")}
          </Button>
        )}
      </div>
    </div>
  );
}
