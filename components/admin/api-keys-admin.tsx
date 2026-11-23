"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { getApiKeys, revokeApiKey, type ApiKey } from "@/lib/api/api-keys";
import { getCenters, type Centro } from "@/lib/api/centers";
import { inTopBarCenter, isFullAccess, isLive, keyStatus, sortKeys, summarize } from "@/lib/api-keys/key-status";
import { topBarSelection } from "@/lib/clinic-read-scope";
import { getActiveCentro, isClinicViewAll } from "@/lib/tenant";
import { useResource } from "@/hooks/use-resource";
import { toastError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, LoadingPanel, Panel, RecordTable, Stat, StatGrid, Td, Th } from "@/components/kit/panel";
import { StatusBadge } from "@/components/kit/status-badge";
import { useConfirm } from "@/components/kit/confirm-host";
import { ApiKeyCreateDialog } from "./api-key-create-dialog";

// API keys (machines and scripts: scales, print hubs, the phone bridge, integrations). Admin-only tab
// of /admin. The risky ones (never used, full access) sort first, so the cleanup is done from here.
// The top bar filters the keys bound to one center (all-centers keys always show; «Ambos» = all);
// the calls themselves read every center (lib/api/api-keys.ts). The picker reloads the page.
// Revoke goes through the BE's confirmation shield: apiFetch shows its dialog (naming the key) and
// repeats the request. Contract: cmr-be docs/specs/api-keys-admin.md; handoff
// docs/specs/api-keys-admin-handoff.md.
export function ApiKeysAdmin() {
  const t = useTranslations("admin.apiKeys");
  const tRoot = useTranslations();
  const format = useFormatter();
  const res = useResource<ApiKey[]>(() => getApiKeys("all"));
  const centers = useResource<Centro[]>(() => getCenters());
  const [q, setQ] = React.useState("");
  const [showDead, setShowDead] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const confirm = useConfirm();

  const keys = inTopBarCenter(res.state.kind === "ok" ? res.state.data : [], topBarSelection(isClinicViewAll(), getActiveCentro()));
  const centerList = centers.state.kind === "ok" ? centers.state.data : [];
  const centerName = (id: string | null) => (id === null ? t("allCenters") : (centerList.find((c) => c.id === id)?.name ?? id));
  const when = (iso: string | null) =>
    iso ? <span className="tabular-nums">{format.dateTime(new Date(iso), "dateAndTime")}</span> : <span className="text-muted-foreground">—</span>;
  const sum = summarize(keys);
  const needle = q.trim().toLowerCase();
  const visible = sortKeys(keys).filter(
    (k) => (showDead || isLive(k)) && (!needle || k.name.toLowerCase().includes(needle) || k.permissions.some((p) => p.includes(needle))),
  );

  async function revoke(k: ApiKey) {
    const ok = await confirm({ title: t("revokeConfirm", { name: k.name }), description: t("revokeHelp"), confirmLabel: t("revoke"), destructive: true });
    if (!ok) return;
    setBusyId(k.id);
    try {
      await revokeApiKey(k.id);
      toast.success(t("revoked", { name: k.name }));
      res.reload();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">{t("help")}</p>

      {res.state.kind === "ok" && (
        <Panel>
          <StatGrid cols={3}>
            <Stat label={t("sum.live")} value={sum.live} />
            <Stat label={t("sum.fullAccess")} value={sum.fullAccess} tone={sum.fullAccess ? "danger" : "muted"} />
            <Stat label={t("sum.neverUsed")} value={sum.neverUsed} hint={t("sum.neverUsedHint", { n: sum.neverUsedFullAccess })} tone={sum.neverUsed ? "danger" : "muted"} />
          </StatGrid>
        </Panel>
      )}

      <Panel
        title={t("title")}
        actions={
          <>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="h-8 w-56" />
            <label htmlFor="api-keys-show-dead" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch id="api-keys-show-dead" checked={showDead} onCheckedChange={setShowDead} />
              {t("showDead")}
            </label>
            <Button size="sm" onClick={() => setCreating(true)}>{t("new")}</Button>
          </>
        }
      >
        {res.state.kind === "loading" && <LoadingPanel rows={6} />}
        {res.state.kind === "fail" && <ErrorState message={res.state.message} />}
        {res.state.kind === "ok" && visible.length === 0 && <EmptyState>{t("empty")}</EmptyState>}
        {res.state.kind === "ok" && visible.length > 0 && (
          <RecordTable
            head={
              <>
                <Th>{t("col.name")}</Th>
                <Th>{t("col.status")}</Th>
                <Th>{t("col.access")}</Th>
                <Th>{t("col.center")}</Th>
                <Th>{t("col.lastUsed")}</Th>
                <Th>{t("col.expires")}</Th>
                <Th>{t("col.created")}</Th>
                <Th />
              </>
            }
          >
            {visible.map((k) => (
              <tr key={k.id} className="hover:bg-muted/30">
                <Td>
                  <div className="font-medium">{k.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</div>
                </Td>
                <Td><StatusBadge kind="apiKey" value={keyStatus(k)} /></Td>
                <Td>
                  {isFullAccess(k) ? (
                    <Badge variant="destructive">{t("fullAccess")}</Badge>
                  ) : k.permissions.length === 0 ? (
                    <span className="text-muted-foreground">{t("noPermissions")}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {k.permissions.map((p) => <code key={p} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{p}</code>)}
                    </div>
                  )}
                </Td>
                <Td className="text-muted-foreground">{centerName(k.clinicId)}</Td>
                <Td>{k.lastUsedAt ? when(k.lastUsedAt) : <Badge variant="warning">{t("never")}</Badge>}</Td>
                <Td>{k.revokedAt ? <span className="text-muted-foreground">{t("revokedOn")} {when(k.revokedAt)}</span> : when(k.expiresAt)}</Td>
                <Td>{when(k.createdAt)}</Td>
                <Td className="text-right">
                  {isLive(k) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t("actions", { name: k.name })} disabled={busyId === k.id}>
                          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem variant="destructive" onSelect={() => void revoke(k)}>{t("revoke")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </Td>
              </tr>
            ))}
          </RecordTable>
        )}
      </Panel>

      {creating && <ApiKeyCreateDialog centers={centerList} onClose={() => setCreating(false)} onCreated={() => res.reload()} />}
    </div>
  );
}
