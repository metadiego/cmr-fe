"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, UserSwitchIcon } from "@hugeicons/core-free-icons";

import { getPendientesEntrega, type PendienteEntrega } from "@/lib/api/frontdesk";
import { buscarPaciente, type PacienteBusqueda } from "@/lib/api/facturas";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import {
  transferManyPackages,
  voidTransfer,
  listTransfers,
  type TreatmentTransfer,
  type TransferManyPayload,
} from "@/lib/api/treatment-transfers";
import {
  transferManyInvalid,
  transferManyItemInvalid,
  transferManyMissing,
  type TransferManyField,
} from "@/lib/facturacion/transfer-many-missing";
import { ApiError } from "@/lib/api/types";
import { apiErrorLabel, toastError } from "@/lib/api/errors";
import { callIfPermitted } from "@/lib/rbac/call-if-permitted";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useMe } from "@/hooks/use-me";
import { useConfirm } from "@/components/kit/confirm-host";
import { useSubmit } from "@/components/kit/use-submit";
import { Panel, EmptyState, LoadingPanel } from "@/components/kit/panel";
import { Field, FormError } from "@/components/kit/field";
import { FormFooter } from "@/components/kit/form-footer";
import { StatusBadge } from "@/components/kit/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// "Transferir tratamiento" tab: move several pending packages to ONE destination in a single step
// (cmr-be #710, .personal/handoff-transferir-tratamiento-completo.md). Rebuilds the earlier
// one-package-at-a-time form (owner, via peer handoff 25-nov-2026): in Caguas it was so confusing that
// a new invoice got made instead of a transfer. The destination is searched ONCE, same as before —
// picking the SAME patient back is now how you move only the center (no separate "scope" picker:
// three buttons that could each be left wrong was exactly the confusion being fixed).
export function FichaTransferirTratamiento({
  pacienteId,
  centro,
}: {
  pacienteId: string;
  centro?: string;
}) {
  const t = useTranslations("patients.transferTreatment");
  const tRoot = useTranslations();
  const confirm = useConfirm();
  const { can } = useCan();
  const me = useMe();
  const permissions = me.kind === "ok" ? me.me.permissions : [];
  const puedeVerPendientes = can("invoice.read");
  const pendRes = useResource<PendienteEntrega[]>(
    () => callIfPermitted(permissions, "invoice.read", () => getPendientesEntrega(pacienteId, centro), []),
    [pacienteId, centro, permissions.join(",")],
  );
  const pendientes = (pendRes.state.kind === "ok" ? pendRes.state.data : []).filter((p) => (p.pendiente ?? 0) > 0);

  const historyRes = useResource<TreatmentTransfer[]>(() => listTransfers(pacienteId, centro), [pacienteId, centro]);
  const history = historyRes.state.kind === "ok" ? historyRes.state.data : [];

  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const destinoCentros = (centrosRes.state.kind === "ok" ? centrosRes.state.data : []).filter((c) => c.id !== centro);

  const [destPatient, setDestPatient] = React.useState<PacienteBusqueda | null>(null);
  const [patientQuery, setPatientQuery] = React.useState("");
  const [destClinicId, setDestClinicId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [advanced, setAdvanced] = React.useState(false);
  const [mode, setMode] = React.useState<"virtual" | "fisica">("virtual");
  const [sourceWarehouseId, setSourceWarehouseId] = React.useState("");
  const [destWarehouseId, setDestWarehouseId] = React.useState("");
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [sessionsByPkg, setSessionsByPkg] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [failedPackageId, setFailedPackageId] = React.useState<string | null>(null);

  function resetDraft() {
    setDestPatient(null);
    setPatientQuery("");
    setDestClinicId("");
    setReason("");
    setError(null);
    setFailedPackageId(null);
  }

  // A different patient prop (navigated to another record): clear the draft, nothing of it applies.
  const [prevPid, setPrevPid] = React.useState(pacienteId);
  if (pacienteId !== prevPid) {
    setPrevPid(pacienteId);
    resetDraft();
  }

  // Default every pending package to checked, with its full pending count, whenever the pending LIST
  // itself changes (first load, or refreshed after a transfer) — not on every keystroke in its own row.
  const pendKey = pendientes.map((p) => `${p.id}:${p.pendiente}`).join(",");
  const [initializedFor, setInitializedFor] = React.useState("");
  if (pendKey !== initializedFor) {
    setInitializedFor(pendKey);
    const nextChecked: Record<string, boolean> = {};
    const nextSessions: Record<string, string> = {};
    for (const p of pendientes) {
      nextChecked[p.id] = true;
      nextSessions[p.id] = String(p.pendiente ?? 0);
    }
    setChecked(nextChecked);
    setSessionsByPkg(nextSessions);
  }

  const isSelf = !!destPatient && String(destPatient.id) === String(pacienteId);
  const destinationPatientId = destPatient?.id ? String(destPatient.id) : "";

  // Debounced patient search, only while picking (none chosen yet).
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  React.useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(patientQuery), 250);
    return () => clearTimeout(h);
  }, [patientQuery]);
  const term = debouncedQuery.trim();
  const searchRes = useResource<PacienteBusqueda[]>(
    () => (!destPatient && term.length >= 2 ? buscarPaciente(term, centro) : Promise.resolve([])),
    [destPatient, term, centro],
  );
  const searchResults = term.length >= 2 ? (searchRes.state.kind === "ok" ? searchRes.state.data : []) : [];
  const searching = searchRes.state.kind === "loading" && term.length >= 2;
  const patientName = (p: PacienteBusqueda) => (p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()) || "—";

  const checkedPackages = pendientes.filter((p) => checked[p.id]);
  const checkedCount = checkedPackages.length;
  const warehousesWanted = mode === "fisica";

  const fieldLabel: Record<TransferManyField, string> = {
    destination: t("destinationPatient"),
    clinic: t("destinationClinic"),
    packages: t("packagesTitle"),
    reason: t("reason"),
  };
  const missing = transferManyMissing({
    destinationPatientId,
    isSelf,
    destinationClinicId: destClinicId,
    reason,
    checkedCount,
  }).map((f) => fieldLabel[f]);
  const problem = transferManyInvalid({
    isSelf,
    destinationClinicId: destClinicId,
    currentClinicId: centro,
    checkedItems: checkedPackages.map((p) => ({ sessions: sessionsByPkg[p.id] ?? "", pending: p.pendiente ?? 0 })),
  });
  const reasonText = problem === "sessionsOutOfRange" ? t("sessionsOutOfRange") : problem === "sameDestination" ? t("sameDestination") : null;
  const blocked = problem != null || (warehousesWanted && (!sourceWarehouseId || !destWarehouseId));

  const { submitting, submit } = useSubmit(
    async () => {
      const payload: TransferManyPayload = {
        items: checkedPackages.map((p) => ({ paqueteId: p.id, sesiones: Number(sessionsByPkg[p.id] ?? p.pendiente ?? 0) })),
        pacienteDestinoId: destinationPatientId,
        ...(isSelf ? { clinicDestinoId: destClinicId } : {}),
        motivo: reason.trim(),
        modo: mode,
        ...(mode === "fisica" ? { almacenOrigenId: sourceWarehouseId, almacenDestinoId: destWarehouseId } : {}),
      };
      return transferManyPackages(payload, centro);
    },
    {
      onSuccess: (r) => {
        toast.success(t("doneMany", { n: r.transferencias?.length ?? checkedCount, patient: destPatient ? patientName(destPatient) : "" }));
        resetDraft();
        pendRes.refresh();
        historyRes.refresh();
      },
      onError: (err) => {
        setError(apiErrorLabel(err, tRoot));
        setFailedPackageId(err instanceof ApiError && typeof err.data?.paqueteId === "string" ? err.data.paqueteId : null);
        return true;
      },
    },
  );

  async function onVoid(tr: TreatmentTransfer) {
    if (!(await confirm({ title: t("voidConfirmTitle"), description: t("voidConfirmBody"), confirmLabel: t("void"), destructive: true }))) return;
    try {
      await voidTransfer(tr.id, centro);
      toast.success(t("voidOk"));
      pendRes.refresh();
      historyRes.refresh();
    } catch (err) {
      toastError(err, tRoot);
    }
  }

  return (
    <div className="space-y-6">
      <Panel title={t("title")} description={t("help")}>
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          {/* Packages: every pending one, all checked by default */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("packagesTitle")}</h3>
              {pendientes.length > 0 && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setChecked(Object.fromEntries(pendientes.map((p) => [p.id, true])))}
                  >
                    {t("checkAll")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setChecked(Object.fromEntries(pendientes.map((p) => [p.id, false])))}
                  >
                    {t("checkNone")}
                  </Button>
                </div>
              )}
            </div>
            {pendRes.state.kind === "loading" && <LoadingPanel rows={3} />}
            {!puedeVerPendientes && pendRes.state.kind === "ok" ? (
              <EmptyState>{t("noPermissionPending")}</EmptyState>
            ) : (
              pendRes.state.kind === "ok" && pendientes.length === 0 && <EmptyState>{t("noPending")}</EmptyState>
            )}
            {pendientes.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {pendientes.map((p) => {
                  const isChecked = checked[p.id] ?? false;
                  const pending = p.pendiente ?? 0;
                  const sessionsVal = sessionsByPkg[p.id] ?? String(pending);
                  const invalidRow = isChecked && transferManyItemInvalid(sessionsVal, pending);
                  const invoiceRef = p.invoiceNumber ?? p.legacyReference ?? "—";
                  return (
                    <li
                      key={p.id}
                      className={"flex items-center gap-3 px-3 py-2 " + (p.id === failedPackageId ? "bg-destructive/5" : "")}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) => setChecked((c) => ({ ...c, [p.id]: v === true }))}
                        aria-label={p.productoNombre ?? p.sku ?? undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.productoNombre ?? p.sku ?? "—"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {invoiceRef} · {t("pendingN", { n: pending, total: p.totalSessions ?? 0 })}
                        </span>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={pending || undefined}
                        className="w-20 shrink-0"
                        value={sessionsVal}
                        disabled={!isChecked}
                        aria-invalid={invalidRow}
                        onChange={(e) => setSessionsByPkg((s) => ({ ...s, [p.id]: e.target.value }))}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Destination: searched once; picking yourself back means "only the center changes" */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("destinationPatient")}</h3>
            <Field label={t("destinationPatient")} htmlFor={destPatient ? undefined : "transfer-patient-search"} required>
              {destPatient ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-accent/40 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {patientName(destPatient)}
                      {isSelf && <span className="font-normal text-muted-foreground">{t("selfSuffix")}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{destPatient.medicalRecordNumber ? `#${destPatient.medicalRecordNumber}` : ""}</span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setDestPatient(null)}>
                    {t("changeSelection")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input id="transfer-patient-search" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder={t("searchPatientPlaceholder")} />
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {term.length < 2 && <p className="py-2 text-center text-xs text-muted-foreground">{t("searchHint")}</p>}
                    {searching && <p className="py-2 text-center text-xs text-muted-foreground">{tRoot("common.loading")}</p>}
                    {term.length >= 2 && !searching && searchResults.length === 0 && (
                      <p className="py-2 text-center text-xs text-muted-foreground">{tRoot("common.noResults")}</p>
                    )}
                    {searchResults.map((p) => {
                      const self = String(p.id) === String(pacienteId);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setDestPatient(p)}
                          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {patientName(p)}
                              {self && <span className="font-normal text-muted-foreground">{t("selfSuffix")}</span>}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{p.medicalRecordNumber ? `#${p.medicalRecordNumber}` : ""}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Field>

            {isSelf && (
              <Field label={t("destinationClinic")} htmlFor="transfer-clinic" hint={t("sameSelfHint")} required>
                <Select value={destClinicId || undefined} onValueChange={setDestClinicId}>
                  <SelectTrigger id="transfer-clinic"><SelectValue placeholder={t("chooseClinic")} /></SelectTrigger>
                  <SelectContent>
                    {destinoCentros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label={t("reason")} htmlFor="transfer-reason" required>
              <Textarea id="transfer-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} rows={2} />
            </Field>

            <Collapsible open={advanced} onOpenChange={setAdvanced}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-0">{t("advancedOptions")}</Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <Field label={t("mode")}>
                  <div className="flex gap-2">
                    {(["virtual", "fisica"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={"flex-1 rounded-md border px-3 py-2 text-left text-sm " + (mode === m ? "border-primary bg-primary/10" : "hover:bg-muted")}
                      >
                        <span className="block font-medium">{t(m)}</span>
                        <span className="block text-[11px] text-muted-foreground">{t(`${m}Help`)}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                {warehousesWanted && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t("sourceWarehouse")} htmlFor="transfer-src-wh" required>
                      <Input id="transfer-src-wh" value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(e.target.value)} />
                    </Field>
                    <Field label={t("destinationWarehouse")} htmlFor="transfer-dst-wh" required>
                      <Input id="transfer-dst-wh" value={destWarehouseId} onChange={(e) => setDestWarehouseId(e.target.value)} />
                    </Field>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <FormError message={error} />
            <FormFooter
              primary={{ label: t("confirmMany", { n: checkedCount }), onClick: () => submit() }}
              missing={missing}
              reason={reasonText}
              blocked={blocked}
              submitting={submitting}
            />
          </section>
        </div>
      </Panel>

      <Panel title={t("historyTitle")}>
        {historyRes.state.kind === "loading" ? (
          <LoadingPanel rows={3} />
        ) : history.length === 0 ? (
          <EmptyState>{t("historyEmpty")}</EmptyState>
        ) : (
          <ul className="divide-y">
            {history.map((tr) => (
              <li key={tr.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <HugeiconsIcon icon={tr.destinationPatientId ? UserSwitchIcon : ArrowRight01Icon} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">
                    {tr.sessions} · {new Date(tr.createdAt).toISOString().slice(0, 10)} {tr.reason ? `· ${tr.reason}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge kind="transfer" value={tr.status} />
                  {tr.status === "aplicada" && (
                    <Button variant="ghost" size="sm" onClick={() => onVoid(tr)}>
                      {t("void")}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
