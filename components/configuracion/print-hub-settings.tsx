"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon } from "@hugeicons/core-free-icons";

import { deletePrintHub, getPrintHub, setPrintHub, type CenterPrinter } from "@/lib/api/print-hub";
import { apiErrorLabel } from "@/lib/api/errors";
import { hubOrigin } from "@/lib/print/hub-target";
import { PrintHubPrinterCard } from "@/components/configuracion/print-hub-printer-card";
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
interface Form {
  enabled: boolean;
  hubUrls: string[];
}

const EMPTY: Form = { enabled: true, hubUrls: [""] };

// Is this browser able to reach the hub? With a self-signed certificate "no" almost always means it has
// not been accepted on this machine yet. The hub answers GET / with CORS.
const probe = (url: string): Promise<Link> => {
  const origin = hubOrigin(url);
  return origin ? fetch(origin + "/", { cache: "no-store" }).then((r) => (r.ok ? "ok" : "fail"), () => "fail") : Promise.resolve("fail");
};

// Per-center backup print configuration (BE /print-hubs). The screen does on sight what used to be
// manual: the center's hubs in order (the branch server first, the emergency one after), whether this
// browser reaches each one plus the link to accept its certificate, and the center's LIST of receipt
// printers (Reception, Billing…), each with Detect, the Windows PC's login and a test print. Each
// machine then picks its printer in the receipt modal. Mount with key={centerId}.
export function PrintHubSettings({ centerId, centerName }: Props) {
  const t = useTranslations("aparienciaCorporativa");
  const tRoot = useTranslations();
  const { can } = useCan();
  const canRead = can("print-hub.read") || can("*");
  const canEdit = can("print-hub.update") || can("*");
  const canDelete = can("print-hub.delete") || can("*");

  const [load, setLoad] = React.useState<"loading" | "ok" | "fail">("loading");
  const [exists, setExists] = React.useState(false);
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [links, setLinks] = React.useState<Record<string, Link>>({});
  const [printers, setPrinters] = React.useState<CenterPrinter[]>([]);
  const [drafts, setDrafts] = React.useState<number[]>([]);
  const [busy, setBusy] = React.useState<"save" | "delete" | null>(null);

  React.useEffect(() => {
    if (!canRead) return;
    let active = true;
    getPrintHub(centerId)
      .then((h) => {
        if (!active) return;
        setExists(!!h);
        if (h) {
          setForm({ enabled: h.enabled, hubUrls: h.hubUrls.length ? h.hubUrls : [""] });
          setPrinters(h.printers ?? []);
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

  const setHub = (i: number, v: string) => setForm((f) => ({ ...f, hubUrls: f.hubUrls.map((u, j) => (j === i ? v : u)) }));
  const moveHub = (i: number, d: -1 | 1) =>
    setForm((f) => {
      const hubUrls = [...f.hubUrls];
      [hubUrls[i], hubUrls[i + d]] = [hubUrls[i + d], hubUrls[i]];
      return { ...f, hubUrls };
    });
  const removeHub = (i: number) => setForm((f) => ({ ...f, hubUrls: f.hubUrls.filter((_, j) => j !== i) }));

  const cleanHubs = form.hubUrls.map((u) => u.trim()).filter(Boolean);
  const discoverHub = cleanHubs.find((u) => links[u] === "ok") ?? cleanHubs[0];

  async function save() {
    setBusy("save");
    try {
      await setPrintHub(centerId, { enabled: form.enabled, hubUrls: cleanHubs, protocol: printers[0]?.protocol ?? "ipp" });
      setExists(true);
      toast.success(t("hubSaved"));
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
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
      setPrinters([]);
      toast.success(t("hubRemoved"));
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(null);
    }
  }


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

        </fieldset>
      )}

      {load === "ok" && (
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" onClick={save} disabled={busy !== null || cleanHubs.length === 0}>
              {busy === "save" ? t("saving") : t("hubSave")}
            </Button>
          )}
          {canDelete && exists && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={busy !== null}>
              {busy === "delete" ? t("saving") : t("hubRemove")}
            </Button>
          )}
        </div>
      )}

      {/* 2. The center's printers; each machine picks one in the receipt modal. */}
      {load === "ok" && exists && (
        <div className="space-y-3 border-t pt-4">
          <div>
            <h4 className="text-sm font-medium">{t("printersTitle")}</h4>
            <p className="text-xs text-muted-foreground">{t("printersHelp")}</p>
          </div>
          {printers.map((p) => (
            <PrintHubPrinterCard
              key={p.id}
              centerId={centerId}
              centerName={centerName}
              printer={p}
              hubUrls={cleanHubs}
              discoverHub={discoverHub}
              canEdit={canEdit}
              canDelete={canDelete}
              onSaved={(saved) => setPrinters((list) => list.map((x) => (x.id === saved.id ? saved : x)))}
              onDeleted={() => setPrinters((list) => list.filter((x) => x.id !== p.id))}
            />
          ))}
          {drafts.map((d) => (
            <PrintHubPrinterCard
              key={`draft-${d}`}
              centerId={centerId}
              centerName={centerName}
              printer={null}
              hubUrls={cleanHubs}
              discoverHub={discoverHub}
              canEdit={canEdit}
              canDelete={canDelete}
              onSaved={(saved) => {
                setPrinters((list) => [...list, saved]);
                setDrafts((ds) => ds.filter((x) => x !== d));
              }}
              onDeleted={() => setDrafts((ds) => ds.filter((x) => x !== d))}
            />
          ))}
          {printers.length === 0 && drafts.length === 0 && <p className="text-sm text-muted-foreground">{t("printersEmpty")}</p>}
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={() => setDrafts((ds) => [...ds, Date.now()])}>
              {t("printerAdd")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
