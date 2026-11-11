"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getBookingRules, setBookingRules, type BookingRuleKey, type BookingRulesConfig } from "@/lib/api/agenda-rules";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

// Qué bloquea al agendar vs. solo avisa, por centro (BE #547). Un interruptor por regla ("Bloquea /
// Solo avisa", per la UI sugerida del handoff) + el de showOffStepStarts. Handoff
// .personal/handoff-avisar-nunca-bloquear.md §5.
export function AgendaRulesAdmin({ centro }: { centro: string }) {
  const t = useTranslations("configuracion.agendaRules");
  const tRoot = useTranslations();
  const res = useResource<BookingRulesConfig>(() => getBookingRules(centro), [centro]);
  const [blocking, setBlocking] = React.useState<Set<BookingRuleKey> | null>(null);
  const [showOffStep, setShowOffStep] = React.useState<boolean | null>(null);
  const [saving, setSaving] = React.useState(false);
  // Ajuste en render (no efecto): una `res.state` fresca manda sobre lo que se estaba editando.
  const [prevData, setPrevData] = React.useState<BookingRulesConfig | null>(null);
  const data = res.state.kind === "ok" ? res.state.data : null;
  if (data !== prevData) {
    setPrevData(data);
    setBlocking(data ? new Set(data.blockingRules) : null);
    setShowOffStep(data ? data.showOffStepStarts : null);
  }

  async function guardar() {
    if (!data || !blocking || showOffStep === null) return;
    setSaving(true);
    try {
      await setBookingRules(centro, { blockingRules: [...blocking], showOffStepStarts: showOffStep }, centro);
      toast.success(t("guardado"));
      res.reload();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setSaving(false);
    }
  }

  if (res.state.kind === "loading") return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{res.state.message}</p>;
  if (!data || !blocking || showOffStep === null) return null;

  const dirty =
    blocking.size !== data.blockingRules.length ||
    data.blockingRules.some((k) => !blocking.has(k)) ||
    showOffStep !== data.showOffStepStarts;

  function toggle(key: BookingRuleKey, on: boolean) {
    setBlocking((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-5">
        {!data.configured && <p className="text-xs text-muted-foreground">{t("valorPorDefecto")}</p>}
        <ul className="divide-y">
          {data.rules.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{tRoot.has(r.labelKey) ? tRoot(r.labelKey) : r.key}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.reasonKeys.map((k) => (tRoot.has(k) ? tRoot(k) : k)).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className={blocking.has(r.key) ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {blocking.has(r.key) ? t("bloquea") : t("soloAvisa")}
                </span>
                <Switch checked={blocking.has(r.key)} onCheckedChange={(v) => toggle(r.key, v)} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-5">
        <div>
          <Label>{tRoot("agenda.showOffStepStarts")}</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("showOffStepStartsHelp")}</p>
        </div>
        <Switch checked={showOffStep} onCheckedChange={setShowOffStep} />
      </div>
      <Button onClick={guardar} disabled={!dirty || saving}>
        {saving ? tRoot("common.saving") : tRoot("common.save")}
      </Button>
    </div>
  );
}
