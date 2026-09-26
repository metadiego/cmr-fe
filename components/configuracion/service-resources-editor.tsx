"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  listResources,
  getServiceResources,
  setServiceResources,
  type Resource,
  type ServiceResourceLine,
} from "@/lib/api/resources";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/kit/form-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// «Qué consume un servicio»: por cada servicio, qué recursos ocupa y cuánto. Es lo que hace que la agenda
// sepa a qué horas cabe. El PUT REEMPLAZA la lista entera. Handoff HANDOFF-FE-agenda-de-terapias (Pantalla 1).
export function ServiceResourcesEditor({ centroId, puedeEscribir }: { centroId?: string; puedeEscribir: boolean }) {
  const t = useTranslations("resources.consumo");
  const tRoot = useTranslations();
  const servRes = useResource<Servicio[]>(() => (centroId ? getServicios(centroId) : getServicios()), [centroId]);
  const recRes = useResource<Resource[]>(() => listResources(centroId), [centroId]);
  const servicios = servRes.state.kind === "ok" ? servRes.state.data : [];
  const recursos = (recRes.state.kind === "ok" ? recRes.state.data : []).filter((r) => r.active);

  const [serviceId, setServiceId] = React.useState<string>("");
  const [lines, setLines] = React.useState<ServiceResourceLine[]>([]);
  const [busy, setBusy] = React.useState(false);
  // Líneas del servicio elegido (useResource, no effect manual → sin setState síncrono en effect).
  const linesRes = useResource<ServiceResourceLine[]>(
    () => (serviceId ? getServiceResources(serviceId, centroId) : Promise.resolve([])),
    [serviceId, centroId],
  );
  const loading = serviceId !== "" && linesRes.state.kind === "loading";
  // Sembrar la copia editable al cargar / cambiar de servicio (ajustar-en-render, no en effect).
  const [seededFor, setSeededFor] = React.useState<string | null>(null);
  if (linesRes.state.kind === "ok" && seededFor !== serviceId) {
    setSeededFor(serviceId);
    setLines(linesRes.state.data);
  }

  const recName = (id: string) => recursos.find((r) => r.id === id)?.name ?? id;
  function addLine() {
    const first = recursos[0]?.id ?? "";
    setLines((ls) => [...ls, { resourceId: first, minutes: 10, per: "session", blocking: true }]);
  }
  function patch(i: number, p: Partial<ServiceResourceLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  }
  function remove(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }
  async function guardar() {
    if (busy || !serviceId) return;
    setBusy(true);
    try {
      await setServiceResources(serviceId, lines, centroId);
      toast.success(t("saved"));
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="max-w-md">
        <Field label={t("pickService")}>
          <Select value={serviceId || undefined} onValueChange={setServiceId}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("pickServicePlaceholder")} /></SelectTrigger>
            <SelectContent>
              {servicios.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {!serviceId ? (
        <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">{t("chooseFirst")}</p>
      ) : loading || seededFor !== serviceId ? (
        <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>
      ) : linesRes.state.kind === "fail" ? (
        <p className="text-sm text-destructive">{linesRes.state.message}</p>
      ) : (
        <div className="space-y-3">
          {recursos.length === 0 && (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">{t("noResources")}</p>
          )}
          {lines.length === 0 ? (
            <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">{t("noLines")}</p>
          ) : (
            <ul className="space-y-2">
              {lines.map((l, i) => (
                <li key={i} className="flex flex-wrap items-end gap-3 rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
                  <div className="min-w-[12rem] flex-1">
                    <Field label={t("resource")}>
                      <Select value={l.resourceId || undefined} onValueChange={(v) => patch(i, { resourceId: v })} disabled={!puedeEscribir}>
                        <SelectTrigger className="w-full"><SelectValue placeholder={recName(l.resourceId)} /></SelectTrigger>
                        <SelectContent>
                          {recursos.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="w-24">
                    <Field label={t("minutes")}>
                      <Input type="number" min={0} value={l.minutes} onChange={(e) => patch(i, { minutes: Number(e.target.value) })} disabled={!puedeEscribir} />
                    </Field>
                  </div>
                  <div className="w-32">
                    <Field label={t("per")}>
                      <Select value={l.per} onValueChange={(v) => patch(i, { per: v as ServiceResourceLine["per"] })} disabled={!puedeEscribir}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="session">{t("perSession")}</SelectItem>
                          <SelectItem value="area">{t("perArea")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <Switch checked={l.blocking} onCheckedChange={(v) => patch(i, { blocking: v })} disabled={!puedeEscribir} />
                    {t("blocking")}
                  </label>
                  {puedeEscribir && (
                    <Button variant="ghost" size="sm" className="pb-2 text-destructive" onClick={() => remove(i)}>{t("remove")}</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{t("perHelp")} · {t("blockingHelp")}</p>
          {puedeEscribir && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={addLine} disabled={recursos.length === 0}>{t("addLine")}</Button>
              <Button size="sm" onClick={guardar} disabled={busy}>{busy ? tRoot("common.saving") : tRoot("common.save")}</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
