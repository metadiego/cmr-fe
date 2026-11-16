"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { GitMergeIcon, Alert02Icon } from "@hugeicons/core-free-icons";

import { buscarPaciente, type PacienteBusqueda } from "@/lib/api/facturas";
import { simulatePatientMerge, mergePatients, type PatientMergePlan } from "@/lib/api/patient-merge";
import { patientMergeBlock, patientMergeMissing, type PatientMergeState } from "@/lib/pacientes/patient-merge-missing";
import { useResource } from "@/hooks/use-resource";
import { toastError } from "@/lib/api/errors";
import { Field, FormDialog } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

type Current = { id: string; name: string; record: string | null };

const nombre = (p: PacienteBusqueda) => (p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()) || "—";

// «Fusionar con…» (BE PR #581, handoff .personal/handoff-fusionar-pacientes.md): dos fichas de la
// misma persona, todo el historial pasa a la ficha BUENA. `simulate` no escribe nada — se muestra
// el plan (filas que se mueven, choques, bloqueos) ANTES de pedir el motivo y fusionar de verdad.
export function PatientMergeButton({ current, centerId, onMerged }: { current: Current; centerId?: string; onMerged: (targetId: string) => void }) {
  const t = useTranslations("patients.merge");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={GitMergeIcon} className="size-4" />
        {t("action")}
      </Button>
      {open && <PatientMergeDialog open={open} onOpenChange={setOpen} current={current} centerId={centerId} onMerged={onMerged} />}
    </>
  );
}

function PatientMergeDialog({
  open,
  onOpenChange,
  current,
  centerId,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: Current;
  centerId?: string;
  onMerged: (targetId: string) => void;
}) {
  const t = useTranslations("patients.merge");
  const tRoot = useTranslations();
  const router = useRouter();

  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(h);
  }, [q]);
  const term = debounced.trim();
  const searchRes = useResource<PacienteBusqueda[]>(
    () => (term.length >= 2 ? buscarPaciente(term, centerId) : Promise.resolve([])),
    [term, centerId],
  );
  const results = (term.length >= 2 && searchRes.state.kind === "ok" ? searchRes.state.data : []).filter((p) => p.id !== current.id);

  const [other, setOther] = React.useState<PacienteBusqueda | null>(null);
  // Sugerencia del handoff: la ficha con récord es la BUENA. Si ambas (o ninguna) lo tienen, queda
  // la actual como buena por defecto; de todos modos se puede invertir con el botón de abajo.
  const [currentIsTarget, setCurrentIsTarget] = React.useState(true);

  // Ajustado en el RENDER (comparando contra el `other` anterior), no en un effect síncrono: se
  // precarga la sugerencia solo la primera vez que se elige una ficha, sin pisar un cambio manual
  // posterior del botón de abajo.
  const [seenOtherId, setSeenOtherId] = React.useState<string | null>(null);
  if ((other?.id ?? null) !== seenOtherId) {
    setSeenOtherId(other?.id ?? null);
    if (other) setCurrentIsTarget(!!current.record || !other.medicalRecordNumber);
  }

  const targetId = other ? (currentIsTarget ? current.id : other.id) : null;
  const duplicateId = other ? (currentIsTarget ? other.id : current.id) : null;
  const pairKey = targetId && duplicateId ? `${duplicateId}>${targetId}` : null;

  const [plan, setPlan] = React.useState<PatientMergePlan | null>(null);
  const [simBusy, setSimBusy] = React.useState(false);
  // Mismo patrón: el reinicio (plan=null, busy=true/false) se ajusta en el render al cambiar el par;
  // el effect solo dispara el fetch real y escribe el resultado desde sus callbacks async.
  const [seenPairKey, setSeenPairKey] = React.useState<string | null>(null);
  const [acceptPast, setAcceptPast] = React.useState(false);
  if (pairKey !== seenPairKey) {
    setSeenPairKey(pairKey);
    setAcceptPast(false); // a past-impact acknowledgement belongs to one pair and direction
    setPlan(null);
    setSimBusy(!!pairKey);
  }
  React.useEffect(() => {
    if (!pairKey || !targetId || !duplicateId) return;
    let active = true;
    simulatePatientMerge(duplicateId, targetId, centerId)
      .then((p) => active && setPlan(p))
      .catch((err) => {
        if (!active) return;
        setPlan(null);
        toastError(err, tRoot);
      })
      .finally(() => active && setSimBusy(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey, centerId]);

  const [reason, setReason] = React.useState("");

  const blocked = (plan?.blocking.length ?? 0) > 0;
  const needsPastAccept = !!plan?.pastReports.changesPastPatientCounts;
  const check: PatientMergeState = {
    hasOther: !!other,
    simulating: simBusy,
    hasPlan: !!plan,
    planBlocked: blocked,
    needsPastAccept,
    acceptPast,
    reason,
  };
  const missingLabel = { otherRecord: t("otherRecord"), acceptPastImpact: t("acceptPastReportImpact"), reason: t("reason") };
  const block = patientMergeBlock(check);
  const blockReason = { simulating: tRoot("common.loading"), simulationFailed: t("simulationFailed"), mergeBlocked: t("blockedReason") };

  const { submitting, submit } = useSubmit(
    async () => {
      // Unreachable while the button is enabled; throwing keeps a save from "succeeding" without merging.
      if (!duplicateId || !targetId) throw new Error(t("otherRecord"));
      await mergePatients(duplicateId, targetId, { reason: reason.trim(), ...(needsPastAccept ? { acceptPastReportImpact: true } : {}) }, centerId);
      return targetId;
    },
    {
      successMessage: t("mergedOk"),
      onSuccess: (target) => {
        onOpenChange(false);
        onMerged(target);
        if (target !== current.id) router.push(`/patients/${target}`);
      },
    },
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t("title")}
      description={t("hint")}
      onSubmit={() => submit()}
      submitLabel={t("merge")}
      submittingLabel={tRoot("common.loading")}
      submitting={submitting}
      missing={patientMergeMissing(check).map((k) => missingLabel[k])}
      blocked={!!block}
      reason={block ? blockReason[block] : null}
    >
      {!other ? (
        <div className="space-y-2">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} />
          {term.length < 2 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("searchHint")}</p>
          ) : searchRes.state.kind === "loading" ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{tRoot("common.loading")}</p>
          ) : results.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{tRoot("common.empty")}</p>
          ) : (
            <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setOther(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                    <span className="truncate">{nombre(p)}</span>
                    {p.medicalRecordNumber && <span className="shrink-0 text-xs text-muted-foreground">#{p.medicalRecordNumber}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span>{t("whichIsGood")}</span>
            <Button type="button" size="sm" variant={currentIsTarget ? "default" : "outline"} onClick={() => setCurrentIsTarget(true)}>
              {current.name}{current.record ? ` #${current.record}` : ""}
            </Button>
            <Button type="button" size="sm" variant={!currentIsTarget ? "default" : "outline"} onClick={() => setCurrentIsTarget(false)}>
              {nombre(other)}{other.medicalRecordNumber ? ` #${other.medicalRecordNumber}` : ""}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setOther(null)}>{tRoot("common.cancel")}</Button>
          </div>

          {simBusy ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{tRoot("common.loading")}</p>
          ) : plan ? (
            <>
              {plan.moves.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-1">{t("colTable")}</th>
                      <th className="py-1 text-right">{t("colRows")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {plan.moves.map((m, i) => (
                      <tr key={i}>
                        <td className="py-1">{tRoot.has(`patients.merge.table.${m.table}`) ? t(`table.${m.table}`) : m.table}</td>
                        <td className="py-1 text-right tabular-nums">{m.rows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {plan.collisions.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {plan.collisions.map((c, i) => (
                    <li key={i}>{tRoot.has(`patients.merge.policy.${c.policy}`) ? t(`policy.${c.policy}`) : c.policy} ({c.table}, {c.rows})</li>
                  ))}
                </ul>
              )}

              {blocked && (
                <Alert variant="destructive">
                  <AlertDescription className="space-y-0.5">
                    {plan.blocking.map((b, i) => (
                      <p key={i} className="flex items-start gap-1.5">
                        <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
                        <span>{b.labelKey && tRoot.has(b.labelKey) ? tRoot(b.labelKey) : (b.message ?? b.code)}</span>
                      </p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {!blocked && needsPastAccept && (
                <Alert variant="warning">
                  <AlertDescription className="space-y-2">
                    <p>{t("changesPastReportsWarning", { months: plan.pastReports.sharedMonths.join(", ") })}</p>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={acceptPast} onCheckedChange={(v) => setAcceptPast(v === true)} />
                      {t("acceptPastReportImpact")}
                    </label>
                  </AlertDescription>
                </Alert>
              )}

              {!blocked && (
                <Field label={t("reason")} required>
                  {/* Enter must not submit: the merge is irreversible, so it only runs from the explicit button. */}
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    placeholder={t("reasonPlaceholder")}
                  />
                </Field>
              )}
            </>
          ) : null}
        </div>
      )}
    </FormDialog>
  );
}
