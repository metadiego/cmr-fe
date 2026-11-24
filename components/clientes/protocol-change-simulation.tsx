"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

import { simularCambioProtocolo, type CambioProtocoloPayload, type ProtocolChangeSimulation } from "@/lib/api/protocol-change";
import { money } from "@/lib/caja/totales";
import { differenceTone, signedMoney } from "@/lib/pacientes/protocol-change-simulation";
import { EmptyState, ErrorState, LoadingPanel, Panel, RecordTable, Td, Th } from "@/components/kit/panel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SimBody = Omit<CambioProtocoloPayload, "reason">;

// The protocol change's «Simulacro» (owner, 23/24-nov-2026; cmr-be #691): what closes and what is created,
// each with an editable price per unit, live totals and the difference. Simulating writes nothing; the
// form applies with the SAME prices. Rows come from the BE's answer; the prices live in the form.
export function ProtocolChangeSimulation({
  pacienteId,
  centro,
  body,
  closePrices,
  onClosePrice,
  createKeys,
  createPrices,
  onCreatePrice,
}: {
  pacienteId: string;
  centro?: string;
  /** Null until both sides are filled (a ticked package and a usable new line). */
  body: SimBody | null;
  closePrices: Readonly<Record<string, string>>;
  onClosePrice: (packageId: string, v: string) => void;
  /** The usable new lines' keys, in the order sent: creates[i] is createKeys[i]. */
  createKeys: readonly number[];
  createPrices: Readonly<Record<number, string>>;
  onCreatePrice: (key: number, v: string) => void;
}) {
  const t = useTranslations("pacientes.cambioProtocolo.sim");
  const tRoot = useTranslations();
  const [sim, setSim] = React.useState<
    { kind: "idle" } | { kind: "loading"; last: ProtocolChangeSimulation | null } | { kind: "ok"; data: ProtocolChangeSimulation } | { kind: "error" }
  >({ kind: "idle" });
  const bodyKey = body ? JSON.stringify(body) : "";

  // Debounced ~400 ms; a later request wins (an older answer arriving late is dropped).
  const seq = React.useRef(0);
  React.useEffect(() => {
    if (!bodyKey) return; // idle is derived below, not stored
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setSim((s) => ({ kind: "loading", last: s.kind === "ok" ? s.data : s.kind === "loading" ? s.last : null }));
      simularCambioProtocolo(pacienteId, JSON.parse(bodyKey) as SimBody, centro)
        .then((data) => mine === seq.current && setSim({ kind: "ok", data }))
        .catch(() => mine === seq.current && setSim({ kind: "error" }));
    }, 400);
    return () => clearTimeout(timer);
  }, [bodyKey, pacienteId, centro]);

  const data = sim.kind === "ok" ? sim.data : sim.kind === "loading" ? sim.last : null;
  const diff = data?.totals.difference ?? null;
  const tone = differenceTone(diff);

  return (
    <Panel title={t("title")} description={t("hint")}>
      {!bodyKey || sim.kind === "idle" ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : sim.kind === "error" ? (
        <ErrorState message={t("error")} />
      ) : !data ? (
        <LoadingPanel />
      ) : (
        <div className={cn("space-y-4 py-4", sim.kind === "loading" && "opacity-60")}>
          <div className="grid gap-4 2xl:grid-cols-2">
            <SimTable caption={t("closes")} t={t}>
              {data.closes.map((c) => (
                <tr key={c.packageId}>
                  <Td>{c.name ?? c.sku ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{c.units}</Td>
                  <Td>
                    <PriceInput
                      id={`sim-close-${c.packageId}`}
                      value={closePrices[c.packageId] ?? ""}
                      proposed={c.chargedUnitPrice}
                      onChange={(v) => onClosePrice(c.packageId, v)}
                      label={c.name ?? ""}
                    />
                    <Ref text={c.chargedUnitPrice != null ? t("charged", { amount: money(c.chargedUnitPrice) }) : null} />
                  </Td>
                  <Td className="text-right tabular-nums">{c.value != null ? money(c.value) : "—"}</Td>
                </tr>
              ))}
            </SimTable>
            <SimTable caption={t("creates")} t={t}>
              {data.creates.map((c, i) => {
                const key = createKeys[i];
                return (
                  <tr key={key ?? `c-${i}`}>
                    <Td>{c.name ?? c.sku ?? "—"}</Td>
                    <Td className="text-right tabular-nums">{c.units}</Td>
                    <Td>
                      {key != null && (
                        <PriceInput
                          id={`sim-create-${key}`}
                          value={createPrices[key] ?? ""}
                          proposed={c.listUnitPrice}
                          onChange={(v) => onCreatePrice(key, v)}
                          label={c.name ?? ""}
                        />
                      )}
                      <Ref text={c.listUnitPrice != null ? t("list", { amount: money(c.listUnitPrice) }) : null} />
                    </Td>
                    <Td className="text-right tabular-nums">{c.value != null ? money(c.value) : "—"}</Td>
                  </tr>
                );
              })}
            </SimTable>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 text-sm tabular-nums">
            <span>{t("totalClosed", { amount: money(data.totals.closedValue) })}</span>
            <span>{t("totalCreated", { amount: money(data.totals.createdValue) })}</span>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 font-semibold",
                tone === "success" && "bg-success/15 text-success",
                tone === "warning" && "bg-warning/20 text-warning-foreground",
              )}
            >
              {t("difference", { amount: diff != null ? signedMoney(diff, money) : "—" })}
            </span>
          </div>

          {(data.warnings ?? []).map((w, i) => (
            <p key={`${w.code ?? "w"}-${i}`} className="mx-5 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
              <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
              {w.labelKey && tRoot.has(w.labelKey) ? tRoot(w.labelKey, (w.params ?? {}) as Record<string, string | number>) : (w.message ?? "")}
            </p>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SimTable({ caption, t, children }: { caption: string; t: (k: string) => string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <h3 className="px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{caption}</h3>
      <RecordTable
        head={
          <tr>
            <Th>{t("product")}</Th>
            <Th right>{t("units")}</Th>
            <Th>{t("unitPrice")}</Th>
            <Th right>{t("value")}</Th>
          </tr>
        }
      >
        {children}
      </RecordTable>
    </div>
  );
}

function PriceInput({ id, value, proposed, onChange, label }: { id: string; value: string; proposed: number | null; onChange: (v: string) => void; label: string }) {
  return (
    <Input
      id={id}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      inputMode="decimal"
      placeholder={proposed != null ? String(proposed) : "—"}
      className="h-8 w-28 text-right tabular-nums"
    />
  );
}

function Ref({ text }: { text: string | null }) {
  return text ? <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">{text}</span> : null;
}
