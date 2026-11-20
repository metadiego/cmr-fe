"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, UserSwitchIcon } from "@hugeicons/core-free-icons";

import { getPendientesEntrega, type PendienteEntrega } from "@/lib/api/frontdesk";
import { buscarPaciente, type PacienteBusqueda } from "@/lib/api/facturas";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { transferPackage, voidTransfer, listTransfers, type TreatmentTransfer } from "@/lib/api/treatment-transfers";
import { treatmentTransferInvalid, treatmentTransferMissing, type TreatmentTransferField } from "@/lib/facturacion/treatment-transfer-missing";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// "Transferir tratamiento" tab (owner, 19-nov-2026): move a package's pending sessions to another
// patient and/or another center. Generalizes the existing center-only transfer
// (components/frontdesk/sesiones-cell.tsx, lib/frontdesk/transfer-treatment-missing.ts) with a
// destination PATIENT — not unified into that dialog, which backs the deprecated frontdesk board's
// row menu and is out of scope here. Handoff docs/specs/transferir-tratamiento-a-otro-paciente-handoff-be.md.
//
// Scope is ONE question with three answers ("to another person" / "to another center" / "both"),
// not two independently optional pickers shown at once — the owner asked for this to be hard to get
// wrong, and letting both fields sit empty-or-filled side by side invites exactly the accidental
// combination (or the accidental no-op) this screen exists to prevent.
type Scope = "otherPatient" | "otherClinic" | "both";
const SCOPES: readonly Scope[] = ["otherPatient", "otherClinic", "both"];

export function FichaTransferirTratamiento({
  pacienteId,
  pacienteNombre,
  centro,
}: {
  pacienteId: string;
  pacienteNombre?: string;
  centro?: string;
}) {
  const t = useTranslations("patients.transferTreatment");
  const tRoot = useTranslations();
  const confirm = useConfirm();
  const { can } = useCan();
  const me = useMe();
  const permissions = me.kind === "ok" ? me.me.permissions : [];
  // invoice.read: sin él, el BE 403 cada llamada (handoff-ruido-403-auditoria.md). Distinto de "sin
  // pendientes" (rule 10: una ausencia nunca se confunde con un hecho) — este tab exige
  // invoice.transfer, que no implica tener también invoice.read.
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

  const [packageId, setPackageId] = React.useState("");
  const [scope, setScope] = React.useState<Scope>("otherPatient");
  const [destPatient, setDestPatient] = React.useState<PacienteBusqueda | null>(null);
  const [patientQuery, setPatientQuery] = React.useState("");
  const [destClinicId, setDestClinicId] = React.useState("");
  const [sessions, setSessions] = React.useState("");
  const [mode, setMode] = React.useState<"virtual" | "fisica">("virtual");
  const [sourceWarehouseId, setSourceWarehouseId] = React.useState("");
  const [destWarehouseId, setDestWarehouseId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [result, setResult] = React.useState<TreatmentTransfer | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // A different patient prop (navigated to another record): clear the draft, nothing of it applies.
  const [prevPid, setPrevPid] = React.useState(pacienteId);
  if (pacienteId !== prevPid) {
    setPrevPid(pacienteId);
    setPackageId("");
    setDestPatient(null);
    setPatientQuery("");
    setDestClinicId("");
    setSessions("");
    setReason("");
    setResult(null);
  }

  const wantsPatient = scope === "otherPatient" || scope === "both";
  const wantsClinic = scope === "otherClinic" || scope === "both";
  const destinationPatientId = wantsPatient ? (destPatient?.id ? String(destPatient.id) : "") : "";
  const destinationClinicId = wantsClinic ? destClinicId : "";

  const pkg = pendientes.find((p) => p.id === packageId) ?? null;
  const pending = pkg?.pendiente ?? 0;

  // Debounced patient search, only while picking (scope wants a patient and none is chosen yet).
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  React.useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(patientQuery), 250);
    return () => clearTimeout(h);
  }, [patientQuery]);
  const term = debouncedQuery.trim();
  const searchRes = useResource<PacienteBusqueda[]>(
    () => (wantsPatient && !destPatient && term.length >= 2 ? buscarPaciente(term, centro) : Promise.resolve([])),
    [wantsPatient, destPatient, term, centro],
  );
  const searchResults = term.length >= 2 ? (searchRes.state.kind === "ok" ? searchRes.state.data : []) : [];
  const searching = searchRes.state.kind === "loading" && term.length >= 2;
  const patientName = (p: PacienteBusqueda) => (p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()) || "—";

  const warehousesWanted = mode === "fisica";
  const fieldLabel: Record<TreatmentTransferField, string> = {
    package: t("step1"),
    destination: t("step2"),
    reason: t("reason"),
  };
  const missing = treatmentTransferMissing({ packageId, pending, destinationPatientId, destinationClinicId, sessions, reason }).map((f) => fieldLabel[f]);
  const problem = treatmentTransferInvalid({ packageId, pending, destinationPatientId, destinationClinicId, sessions, reason });
  const reasonText =
    problem === "nothingPending" ? t("nothingPending") : problem === "sessionsOutOfRange" ? t("sessionsOutOfRange", { n: pending }) : null;
  const blocked = problem != null || (warehousesWanted && (!sourceWarehouseId || !destWarehouseId));

  const { submitting, submit } = useSubmit(
    async () => {
      const n = Number(sessions);
      const payload = {
        ...(destinationPatientId ? { destinationPatientId } : {}),
        ...(destinationClinicId ? { destinationClinicId } : {}),
        ...(sessions.trim() !== "" && n < pending ? { sessions: n } : {}),
        mode,
        ...(mode === "fisica" ? { sourceWarehouseId, destinationWarehouseId: destWarehouseId } : {}),
        ...(destinationPatientId ? { reason: reason.trim() } : {}),
      };
      return transferPackage(packageId, payload, centro);
    },
    {
      onSuccess: (r) => {
        toast.success(t("done"));
        setResult(r);
        setPackageId("");
        setDestPatient(null);
        setPatientQuery("");
        setDestClinicId("");
        setSessions("");
        setReason("");
        setError(null);
        pendRes.refresh();
        historyRes.refresh();
      },
      onError: (err) => {
        setError(apiErrorLabel(err, tRoot));
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
      if (result?.id === tr.id) setResult(null);
    } catch (err) {
      toastError(err, tRoot);
    }
  }

  return (
    <div className="space-y-6">
      <Panel title={t("title")} description={t("help")}>
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          {/* Step 1: what gets transferred */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("step1")}</h3>
            {pendRes.state.kind === "loading" && <LoadingPanel rows={3} />}
            {!puedeVerPendientes && pendRes.state.kind === "ok" ? (
              <EmptyState>{t("noPermissionPending")}</EmptyState>
            ) : (
              pendRes.state.kind === "ok" && pendientes.length === 0 && <EmptyState>{t("noPending")}</EmptyState>
            )}
            <ul className="space-y-2">
              {pendientes.map((p) => {
                const picked = p.id === packageId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPackageId(picked ? "" : p.id)}
                      className={
                        "w-full rounded-md border px-3 py-2 text-left " + (picked ? "border-primary bg-primary/5" : "hover:bg-muted")
                      }
                    >
                      <span className="block text-sm font-medium">{p.productoNombre ?? p.sku ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">{t("pendingN", { n: p.pendiente ?? 0, total: p.totalSessions ?? 0 })}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Step 2: where to */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("step2")}</h3>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={"rounded-md border px-3 py-2 text-left text-sm " + (scope === s ? "border-primary bg-primary/10" : "hover:bg-muted")}
                >
                  {t(`scope.${s}`)}
                </button>
              ))}
            </div>

            {wantsPatient && (
              <Field label={t("destinationPatient")} htmlFor={destPatient ? undefined : "transfer-patient-search"} required>
                {destPatient ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-accent/40 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{patientName(destPatient)}</span>
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
                        const isSelf = String(p.id) === String(pacienteId);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={isSelf}
                            onClick={() => setDestPatient(p)}
                            className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{patientName(p)}</span>
                              <span className="block truncate text-xs text-muted-foreground">{p.medicalRecordNumber ? `#${p.medicalRecordNumber}` : ""}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Field>
            )}

            {wantsClinic && (
              <Field label={t("destinationClinic")} htmlFor="transfer-clinic" required>
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

            <Field label={t("sessions")} htmlFor="transfer-sessions" hint={pkg ? t("sessionsHint", { n: pending }) : undefined}>
              <Input
                id="transfer-sessions"
                type="number"
                min={1}
                max={pending || undefined}
                value={sessions}
                disabled={!pkg}
                aria-invalid={problem === "sessionsOutOfRange"}
                onChange={(e) => setSessions(e.target.value)}
              />
            </Field>

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

            {wantsPatient && (
              <Field label={t("reason")} htmlFor="transfer-reason" required>
                <Textarea id="transfer-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} rows={2} />
              </Field>
            )}

            <FormError message={error} />
            <FormFooter primary={{ label: t("confirm"), onClick: () => submit() }} missing={missing} reason={reasonText} blocked={blocked} submitting={submitting} />
          </section>
        </div>
      </Panel>

      {result && <TransferResult result={result} pacienteId={pacienteId} pacienteNombre={pacienteNombre} />}

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

// The before/after the owner explicitly asked for: read back both sides so staff see it worked
// without leaving the tab. "Before" the source is simply its refreshed pending list above; this
// panel only needs to confirm the DESTINATION now carries the sessions.
function TransferResult({
  result,
  pacienteId,
  pacienteNombre,
}: {
  result: TreatmentTransfer;
  pacienteId: string;
  pacienteNombre?: string;
}) {
  const t = useTranslations("patients.transferTreatment");
  const me = useMe();
  const permissions = me.kind === "ok" ? me.me.permissions : [];
  const destPatientId = result.destinationPatientId ?? pacienteId;
  const destCentro = result.destinationClinicId;
  const destRes = useResource<PendienteEntrega[]>(
    () => callIfPermitted(permissions, "invoice.read", () => getPendientesEntrega(destPatientId, destCentro), []),
    [destPatientId, destCentro, permissions.join(",")],
  );
  const destPkg = (destRes.state.kind === "ok" ? destRes.state.data : []).find((p) => p.id === result.destinationPackageId);

  return (
    <Panel title={t("resultTitle")}>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="block text-xs text-muted-foreground">{t("resultSource")}</span>
          <span className="font-medium">{pacienteNombre ?? "—"}</span>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="block text-xs text-muted-foreground">{t("resultDestination")}</span>
          <span className="font-medium">
            {destRes.state.kind === "loading" ? "…" : destPkg ? t("pendingN", { n: destPkg.pendiente ?? 0, total: destPkg.totalSessions ?? 0 }) : "—"}
          </span>
        </div>
      </div>
    </Panel>
  );
}
