"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Delete02Icon, MoreVerticalIcon, PrinterIcon } from "@hugeicons/core-free-icons";

import { PageContainer } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/kit/field";
import { Panel, ErrorState, LoadingPanel } from "@/components/kit/panel";
import { StatusBadge } from "@/components/kit/status-badge";
import { GenericFormatoRender } from "@/components/frontdesk/formato-generico";
import { FORMAT_PRINTED_EVENT } from "@/components/frontdesk/formato-parts";
import { SheetQuestions } from "@/components/format-sheet/sheet-questions";
import { VoidSheetDialog } from "@/components/format-sheet/void-sheet-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { getFormatoArmado, getFormatos, type FormatoArmado, type FormatoCampo } from "@/lib/api/formatos";
import { getSheetAnswers, saveSheetAnswers, type SheetAnswers } from "@/lib/api/format-answers";
import { listPersonalAll, type PersonalEnAlcance } from "@/lib/api/personal";
import {
  answeredCount,
  fillableSlugsFrom,
  initialSheetState,
  isReadOnlyField,
  LIMITS,
  sheetPayload,
  sheetProblems,
  sheetQuestions,
  shouldAutosave,
  writeBackErrorOf,
  writeBackProblems,
  type RangeProblem,
  type SheetState,
  sheetTextAreas,
} from "@/lib/format-sheet/sheet";

type Loaded = { assembly: FormatoArmado; answers: SheetAnswers; staff: PersonalEnAlcance[] };

// One visit's sheet on the iPad: the header the nurse measures (pre-filled from the visit: weight from
// the scale, last dose, treatment week), the checklist as Yes / No toggles with optional notes, the
// additional notes, the nurse and the date and time. Saved per visit (PUT …/answers, the whole sheet);
// Print shows the paper with what was saved.
export function SheetEditor({ slug, sessionId }: { slug: string; sessionId: string }) {
  const t = useTranslations("formSheet.sheet");
  const res = useResource<Loaded>(async () => {
    const answers = await getSheetAnswers(slug, sessionId);
    const [assembly, staff, formatos] = await Promise.all([
      getFormatoArmado(slug, sessionId, answers.clinicId),
      // Who can sign: active staff with an account in the visit's center (the BE validates nurseId).
      listPersonalAll({}, answers.clinicId).catch(() => [] as PersonalEnAlcance[]),
      // Generic per format (cmr-be #665, no FE-side slug list): this screen only renders what GET
      // /formats itself marks `fillable`. A server component can't call the API (no browser
      // session), so this is the one place that check can actually run.
      getFormatos(undefined, answers.clinicId),
    ]);
    if (!fillableSlugsFrom(formatos).has(slug)) throw new Error(t("notFillable"));
    return { assembly, answers, staff: staff.filter((p) => p.active && p.profileId) };
  }, [slug, sessionId]);

  if (res.state.kind === "loading") {
    return (
      <PageContainer gap="lg" className="w-full px-4 py-4 md:px-6">
        <LoadingPanel rows={3} />
        <LoadingPanel rows={8} />
      </PageContainer>
    );
  }
  if (res.state.kind === "fail") {
    return (
      <PageContainer gap="lg" className="w-full px-4 py-4 md:px-6">
        <BackLink />
        <ErrorState message={`${t("loadError")} — ${res.state.message}`} />
      </PageContainer>
    );
  }
  if (res.state.kind !== "ok") return null;
  return <SheetForm key={sessionId} slug={slug} sessionId={sessionId} data={res.state.data} />;
}

// No list page to link back to (removed with «Enviar al iPad», cmr-be #661 reverted): this is reached
// only from the patient-desk formats modal's «Llenar en pantalla» or its QR, so browser-back returns there.
function BackLink() {
  const t = useTranslations("formSheet.sheet");
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.back()}>
      <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
      {t("back")}
    </Button>
  );
}

const fieldLabel = (f: FormatoCampo, tr: (k: string) => string) =>
  (f.label ?? (f.labelKey ? tr(f.labelKey) : f.clave)).replace(/:\s*$/, "");

function SheetForm({ slug, sessionId, data }: { slug: string; sessionId: string; data: Loaded }) {
  const t = useTranslations("formSheet.sheet");
  const tRoot = useTranslations();
  const format = useFormatter();
  const tr = (k: string) => (tRoot.has(k) ? tRoot(k) : k);
  const center = data.answers.clinicId;

  const questions = React.useMemo(() => sheetQuestions(data.assembly), [data.assembly]);
  const firstSection = questions[0]?.section ?? 0;
  const allFields = data.assembly.fields ?? [];
  const editable = allFields.filter((f) => !isReadOnlyField(f));
  const editableKeys = editable.map((f) => f.clave);

  const areas = React.useMemo(() => sheetTextAreas(data.assembly), [data.assembly]);

  const [answers, setAnswers] = React.useState<SheetAnswers>(data.answers);
  const [state, setState] = React.useState<SheetState>(() => initialSheetState(data.answers, firstSection));
  const payload = sheetPayload(state, editableKeys, questions, areas);
  const payloadJson = JSON.stringify(payload);
  // The baseline is what the sheet opened with, saved or not: only a change the nurse makes saves.
  // Opening an unsaved sheet must never write it (a saved sheet prints on the patient's record and
  // blocks deleting the visit) — it used to autosave the bare suggestions one second after opening.
  const [savedJson, setSavedJson] = React.useState(() => payloadJson);
  const dirty = payloadJson !== savedJson;
  const [printing, setPrinting] = React.useState(false);
  // The print preview closes once the print window is done (formato-parts, owner 25-nov-2026).
  React.useEffect(() => {
    if (!printing) return;
    const close = () => setPrinting(false);
    window.addEventListener(FORMAT_PRINTED_EVENT, close);
    return () => window.removeEventListener(FORMAT_PRINTED_EVENT, close);
  }, [printing]);
  const [voiding, setVoiding] = React.useState(false);
  const { can } = useCan();

  // After a void the sheet is blank again (cmr-be #685): start over from what the BE answered, and
  // make that the autosave baseline, so the void itself is never followed by a save.
  function afterVoid(sheet: SheetAnswers) {
    // A pending autosave timer is dropped by the effect's cleanup once the baseline matches.
    const next = initialSheetState(sheet, firstSection);
    setAnswers(sheet);
    setState(next);
    setSavedJson(JSON.stringify(sheetPayload(next, editableKeys, questions, areas)));
    setStatus("idle");
    setVoiding(false);
  }
  // No separate Guardar any more (owner, 21-nov-2026): every change saves itself. "offline" covers any
  // failed attempt (network, or an unexpected BE rejection) — it retries on its own; it is never shown
  // for a problem this screen already knows about client-side (`reason` below), which blocks the
  // attempt instead of wasting a call that would just fail the same way again.
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "offline">(data.answers.saved ? "saved" : "idle");

  const patient = data.answers.suggested?.patient;
  const date = data.answers.suggested?.date;
  const staff = data.staff;
  const nurseOptions =
    state.nurseId && !staff.some((p) => p.id === state.nurseId) && data.answers.suggested?.nurse?.id === state.nurseId
      ? [{ id: state.nurseId, name: data.answers.suggested.nurse.name }]
      : [];

  // Weight that also corrects the scale: out of range is checked here, and the BE's 400 lands on the field.
  const [serverRange, setServerRange] = React.useState<RangeProblem | null>(null);
  const ranges = writeBackProblems(editable, state.fields);
  const rangeOf = (key: string) => ranges.find((r) => r.key === key) ?? (serverRange?.key === key ? serverRange : null);
  const rangeText = (r: RangeProblem) => {
    const f = allFields.find((x) => x.clave === r.key);
    return t("outOfRange", { label: f ? fieldLabel(f, tr) : r.key, min: r.min ?? "—", max: r.max ?? "—", unit: f?.unit ?? "" }).replace(/\s+\./, ".");
  };

  const problems = sheetProblems(state);
  const reason = ranges.length > 0 ? rangeText(ranges[0]) :
    problems.length === 0
      ? null
      : problems[0].kind === "field"
        ? t("tooLongField", {
            label: fieldLabel(allFields.find((f) => f.clave === (problems[0] as { key: string }).key) ?? { clave: "" }, tr),
            max: LIMITS.field,
          })
        : problems[0].kind === "note"
          ? t("tooLongNote", { max: LIMITS.note })
          : t("tooLongNotes", { max: LIMITS.additionalNotes });

  const setField = (key: string, value: string) => {
    if (serverRange?.key === key) setServerRange(null);
    setState((s) => ({ ...s, fields: { ...s.fields, [key]: value } }));
  };

  // Autosave: debounced ~1s after a change, or retried every 5s while "offline". A ref carries the
  // latest payload into the timeout so the scheduling effect's own deps stay cheap (payloadJson, a
  // string) instead of resetting on every unrelated re-render; `timerRef` lets Imprimir flush a
  // pending save instead of leaving a duplicate one to fire later on its own.
  const pendingSave = React.useRef({ slug, sessionId, payload, center });
  React.useEffect(() => {
    pendingSave.current = { slug, sessionId, payload, center };
  });
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const attemptSave = React.useCallback(async () => {
    const { slug: s, sessionId: sid, payload: p, center: c } = pendingSave.current;
    setStatus("saving");
    try {
      const saved = await saveSheetAnswers(s, sid, p, c);
      setAnswers(saved);
      setSavedJson(JSON.stringify(p));
      setServerRange(null);
      setStatus("saved");
    } catch (err) {
      setServerRange(writeBackErrorOf(err));
      setStatus("offline");
    }
  }, []);

  React.useEffect(() => {
    if (!shouldAutosave({ dirty, saving: status === "saving", blocked: !!reason })) return;
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null;
        void attemptSave();
      },
      status === "offline" ? 5000 : 1000,
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [payloadJson, dirty, reason, status, attemptSave]);

  async function flushAndPrint() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dirty && !reason) await attemptSave();
    setPrinting(true);
  }

  return (
    <PageContainer gap="lg" className="w-full px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
          <BackLink />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{patient?.name ?? "—"}</h1>
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("record")} {patient?.medicalRecordNumber ?? "—"} · {date ?? "—"}
              {data.answers.clinicName ? ` · ${data.answers.clinicName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="sheet" value={answers.saved ? "saved" : "pending"} />
          <span className="text-xs text-muted-foreground tabular-nums">
            {reason
              ? reason
              : status === "saving"
                ? t("saving")
                : status === "offline"
                  ? t("offline")
                  : answers.saved && answers.updatedAt
                    ? t("savedAt", { when: format.dateTime(new Date(answers.updatedAt), "time") })
                    : t("notSaved")}
          </span>
          <Button variant="outline" onClick={() => void flushAndPrint()}>
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
            {t("print")}
          </Button>
          {answers.saved && can("formats.void") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("more")}>
                  <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => setVoiding(true)}>
                  <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  {t("void.action")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Panel title={t("header")}>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {editable.map((f) => (
            <Field key={f.clave} label={fieldLabel(f, tr)} htmlFor={`f-${f.clave}`} error={(() => { const r = rangeOf(f.clave); return r ? rangeText(r) : null; })()}>
              {/* `unit` (Peso → lb) sits inside the box: the nurse types only the number. */}
              <div className="relative">
                <Input
                  id={`f-${f.clave}`}
                  value={state.fields[f.clave] ?? ""}
                  onChange={(e) => setField(f.clave, e.target.value)}
                  inputMode={f.unit ? "decimal" : undefined}
                  className={"h-12 text-base tabular-nums" + (f.unit ? " pr-10" : "")}
                  autoComplete="off"
                />
                {f.unit && (
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{f.unit}</span>
                )}
              </div>
            </Field>
          ))}
        </div>
      </Panel>

      <Panel title={t("questions")} actions={<span className="text-xs text-muted-foreground tabular-nums">{t("answered", { n: answeredCount(state, questions), total: questions.length })}</span>}>
        <SheetQuestions
          questions={questions}
          answers={state.answers}
          onChange={(key, next) => setState((s) => ({ ...s, answers: { ...s.answers, [key]: next } }))}
        />
      </Panel>

      <Panel title={t("signature")}>
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* One area per free-text section of the format (BPC-157 has two, GLP-1 one); labels from the format. */}
          <div className="grid content-start gap-4">
            {areas.keyed.map((a) => (
              <Field key={a.key} label={a.label ?? t("additionalNotes")} htmlFor={`sheet-note-${a.key}`}>
                <Textarea
                  id={`sheet-note-${a.key}`}
                  rows={3}
                  value={state.notes[a.key] ?? ""}
                  onChange={(e) => setState((s) => ({ ...s, notes: { ...s.notes, [a.key]: e.target.value } }))}
                  className="text-base"
                />
              </Field>
            ))}
            {areas.unkeyed && (
              <Field label={t("additionalNotes")} htmlFor="sheet-notes">
                <Textarea
                  id="sheet-notes"
                  rows={4}
                  value={state.additionalNotes}
                  onChange={(e) => setState((s) => ({ ...s, additionalNotes: e.target.value }))}
                  className="text-base"
                />
              </Field>
            )}
          </div>
          <div className="grid content-start gap-4">
            <Field label={t("nurse")} htmlFor="sheet-nurse">
              <Select value={state.nurseId || undefined} onValueChange={(v) => setState((s) => ({ ...s, nurseId: v }))}>
                <SelectTrigger id="sheet-nurse" className="h-12 w-full text-base">
                  <SelectValue placeholder={t("nursePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {[...nurseOptions, ...staff.map((p) => ({ id: p.id, name: [p.name, p.lastName].filter(Boolean).join(" ") }))].map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("recordedAt")} htmlFor="sheet-when">
              <Input
                id="sheet-when"
                type="datetime-local"
                value={state.recordedAt}
                onChange={(e) => setState((s) => ({ ...s, recordedAt: e.target.value }))}
                className="h-12 text-base tabular-nums"
              />
            </Field>
          </div>
        </div>
      </Panel>

      {voiding && (
        <VoidSheetDialog slug={slug} sessionId={sessionId} centerId={center} onClose={() => setVoiding(false)} onVoided={afterVoid} />
      )}

      <Dialog open={printing} onOpenChange={setPrinting}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("printTitle")}</DialogTitle>
            {dirty && <DialogDescription className="text-warning-foreground">{t("printSavedOnly")}</DialogDescription>}
          </DialogHeader>
          {printing && (
            <GenericFormatoRender
              key={answers.updatedAt ?? "blank"}
              clave={slug}
              sesionId={sessionId}
              centro={center}
              onVolver={() => setPrinting(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
