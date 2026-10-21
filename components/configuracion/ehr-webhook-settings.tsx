"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { env } from "@/lib/env";
import { ehrWebhookUrl } from "@/lib/ehr/webhook-url";
import { getEhrConfig, listEhrEvents, setEhrConfig, type EhrConfig, type EhrEvent } from "@/lib/api/ehr-integration";
import type { Centro } from "@/lib/api/centers";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

const EHR_WEBHOOK_URL = ehrWebhookUrl(env.API_BASE_URL);

// «Eventos del EHR (webhook)»: the URL to give the EHR, the shared secret (WRITE-ONLY — the screen never
// shows it, not even after saving; it only says whether it is set) and the last events received.
export function EhrWebhookSettings({
  centroId,
  puedeEscribir,
  centrosEscribibles,
}: {
  centroId?: string;
  puedeEscribir: boolean;
  // Centers where this user can write the config: «apply to all» saves the same secret in each.
  centrosEscribibles: Centro[];
}) {
  const t = useTranslations("ehrIntegration.webhook");
  const tRoot = useTranslations();
  const format = useFormatter();
  const cfg = useResource<EhrConfig>(() => getEhrConfig(centroId), [centroId]);
  const events = useResource<EhrEvent[]>(() => listEhrEvents(20, centroId).catch(() => []), [centroId]);
  const [editing, setEditing] = React.useState(false);
  const [secret, setSecret] = React.useState("");
  const [allCenters, setAllCenters] = React.useState(centrosEscribibles.length > 1);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const isSet = cfg.state.kind === "ok" && !!cfg.state.data.webhookSecretSet;

  async function copy() {
    try {
      await navigator.clipboard.writeText(EHR_WEBHOOK_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  async function save(value: string) {
    setBusy(true);
    try {
      const targets = allCenters && centrosEscribibles.length > 1 ? centrosEscribibles.map((c) => c.id) : [centroId];
      for (const id of targets) await setEhrConfig({ webhookSecret: value }, id);
      toast.success(t(value ? "saved" : "cleared"));
      setSecret("");
      setEditing(false);
      cfg.reload();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  const list = events.state.kind === "ok" ? events.state.data : [];

  return (
    <section className="space-y-4 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("help")}</p>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t("url")}</span>
        <div className="flex gap-2">
          <Input readOnly value={EHR_WEBHOOK_URL} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={copy}>
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} className="size-4" />
            {t(copied ? "copied" : "copy")}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">{t("secret")}</span>
          {cfg.state.kind === "loading" ? (
            <Skeleton className="h-5 w-28" />
          ) : (
            <Badge variant={isSet ? "secondary" : "outline"}>{t(isSet ? "secretSet" : "secretUnset")}</Badge>
          )}
          {puedeEscribir && !editing && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t(isSet ? "change" : "set")}
            </Button>
          )}
        </div>
        {editing && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Write-only: never pre-filled, never shown back. */}
            <Input
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={t("secretPh")}
              className="w-80"
            />
            <Button type="button" size="sm" disabled={busy || !secret} onClick={() => save(secret)}>
              {tRoot("common.save")}
            </Button>
            {isSet && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => save("")}>
                {t("clear")}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setEditing(false); setSecret(""); }}>
              {tRoot("common.cancel")}
            </Button>
            {centrosEscribibles.length > 1 && (
              <label className="flex w-full items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={allCenters} onCheckedChange={(v) => setAllCenters(v === true)} />
                {t("allCenters", { n: centrosEscribibles.length })}
              </label>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t("recent")}</span>
        <div className="overflow-x-auto rounded-md ring-1 ring-foreground/10">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-semibold">{t("col.receivedAt")}</th>
                <th className="px-3 py-1.5 font-semibold">{t("col.type")}</th>
                <th className="px-3 py-1.5 font-semibold">{t("col.record")}</th>
                <th className="px-3 py-1.5 font-semibold">{t("col.patient")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.state.kind === "loading" && (
                <tr><td colSpan={4} className="px-3 py-2"><Skeleton className="h-4 w-full" /></td></tr>
              )}
              {events.state.kind === "ok" && list.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">{t("noEvents")}</td></tr>
              )}
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{format.dateTime(new Date(e.receivedAt), "dateAndTime")}</td>
                  <td className="px-3 py-1.5 font-mono">{e.eventType}</td>
                  <td className="px-3 py-1.5 tabular-nums">{e.patientRecord ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    {e.patientId ? (e.patient?.name ?? t("linked")) : <span className="text-muted-foreground">{t("notLinked")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
