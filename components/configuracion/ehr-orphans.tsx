"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listEhrOrphans, linkEhrPatient, type EhrOrphan } from "@/lib/api/ehr-integration";
import { type Paciente } from "@/lib/api/pacientes";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PacienteSelect } from "@/components/citas/paciente-select";

// Huérfanos del EHR: pacientes creados en el otro sistema sin atar a uno nuestro. Rejilla sencilla: cada
// fila muestra al del EHR, propone el nuestro cuando el documento coincide (o deja elegirlo a mano) y un
// botón «Enlazar». Handoff be-ehr-integration-presente-handoff §huérfanos.
export function EhrOrphans({ centroId, puedeEscribir }: { centroId?: string; puedeEscribir: boolean }) {
  const t = useTranslations("ehrIntegration.orphans");
  const tRoot = useTranslations();
  const { state, reload } = useResource<EhrOrphan[]>(() => listEhrOrphans(500, centroId), [centroId]);
  // Paciente elegido a mano por fila (cuando no hay sugerido) y filas ya enlazadas (para sacarlas).
  const [picked, setPicked] = React.useState<Record<string, Paciente | null>>({});
  const [linked, setLinked] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<string | null>(null);

  async function enlazar(o: EhrOrphan) {
    const ourId = o.pacienteSugeridoId ?? picked[o.ehrPatientId]?.id ?? "";
    if (!ourId) return;
    setBusy(o.ehrPatientId);
    try {
      await linkEhrPatient(ourId, { ehrPatientId: o.ehrPatientId, ehrRecordId: o.ehrRecordId }, centroId);
      setLinked((s) => new Set(s).add(o.ehrPatientId));
      toast.success(t("linked"));
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(null);
    }
  }

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (state.kind === "fail") return <p className="text-sm text-destructive">{state.message}</p>;

  const orphans = state.data.filter((o) => !linked.has(o.ehrPatientId));

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("help")}</p>
      </div>

      {orphans.length === 0 ? (
        <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("colEhr")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("colOurs")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {orphans.map((o) => {
                const puede = puedeEscribir && !!(o.pacienteSugeridoId ?? picked[o.ehrPatientId]?.id);
                return (
                  <tr key={o.ehrPatientId} className="border-t align-top">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{o.nombre ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.ehrRecordId ? `#${o.ehrRecordId}` : "—"}
                        {o.documento ? ` · ${o.documento}` : ""}
                        {o.fechaNacimiento ? ` · ${o.fechaNacimiento}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {o.pacienteSugeridoId ? (
                        <Badge variant="secondary">{t("suggested", { doc: o.documento ?? "" })}</Badge>
                      ) : (
                        <div className="min-w-[16rem]">
                          <PacienteSelect
                            value={picked[o.ehrPatientId] ?? null}
                            onChange={(p) => setPicked((prev) => ({ ...prev, [o.ehrPatientId]: p }))}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" onClick={() => enlazar(o)} disabled={!puede || busy === o.ehrPatientId}>
                        {busy === o.ehrPatientId ? t("linking") : t("link")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={reload} className="text-xs text-primary hover:underline">{t("refresh")}</button>
    </section>
  );
}
