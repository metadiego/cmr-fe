"use client";

import { useTranslations } from "next-intl";

import { listCalls } from "@/lib/api/callcenter";
import { useResource } from "@/hooks/use-resource";
import { Panel, EmptyState, LoadingPanel, ErrorState } from "@/components/kit/panel";
import { CallcenterRecordingButton } from "./callcenter-recording-button";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" });
}

// Handoff §1: the 3CX gets its own small panel, like the legacy screen — always today's 3CX calls,
// independent of the main dashboard's "Central" selector above it.
export function Callcenter3cxPanel({ from, refreshKey }: { from: string; refreshKey: number }) {
  const t = useTranslations("callcenter");
  const key = `${from}|${refreshKey}`;
  const { state } = useResource(() => listCalls({ from, to: from, pbx: "3cx", limit: 50 }, null), [key]);

  return (
    <Panel title={t("threecxTitle")}>
      {state.kind === "loading" && <LoadingPanel rows={3} />}
      {state.kind === "fail" && <ErrorState message={state.message} />}
      {state.kind === "ok" && state.data.items.length === 0 && <EmptyState>{t("threecxEmpty")}</EmptyState>}
      {state.kind === "ok" && state.data.items.length > 0 && (
        <ul className="divide-y">
          {state.data.items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
              <span className="min-w-0">
                <span className="block font-medium">
                  {fmtTime(c.startedAt)} · {c.address ? t(`direction.${c.address}`) : "—"}
                </span>
                <span className="block truncate text-muted-foreground">
                  {c.extension ?? "—"} · {c.from ?? "—"} → {c.toNumber ?? "—"} · {c.status}
                </span>
              </span>
              {c.recordingFile && <CallcenterRecordingButton callId={c.id} />}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
