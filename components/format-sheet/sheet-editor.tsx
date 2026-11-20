"use client";

import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, PrinterIcon } from "@hugeicons/core-free-icons";

import { PageContainer } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/kit/field";
import { FormFooter } from "@/components/kit/form-footer";
import { Panel, ErrorState, LoadingPanel } from "@/components/kit/panel";
import { StatusBadge } from "@/components/kit/status-badge";
import { useSubmit } from "@/components/kit/use-submit";
import { GenericFormatoRender } from "@/components/frontdesk/formato-generico";
import { SheetQuestions } from "@/components/format-sheet/sheet-questions";
import { useResource } from "@/hooks/use-resource";
import { useSheetLive } from "@/hooks/use-sheet-live";
import { getFormatoArmado, type FormatoArmado, type FormatoCampo } from "@/lib/api/formatos";
import { getSheetAnswers, saveSheetAnswers, type SheetAnswers } from "@/lib/api/format-answers";
import { listPersonalAll, type PersonalEnAlcance } from "@/lib/api/personal";
import {
  answeredCount,
  initialSheetState,
  isReadOnlyField,
  LIMITS,
  sheetHomePath,
  sheetPayload,
  sheetProblems,
  sheetQuestions,
  type SheetState,
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
    const [assembly, staff] = await Promise.all([
      getFormatoArmado(slug, sessionId, answers.clinicId),
      // Who can sign: active staff with an account in the visit's center (the BE validates nurseId).
      listPersonalAll({}, answers.clinicId).catch(() => [] as PersonalEnAlcance[]),
    ]);
    return { assembly, answers, staff: staff.filter((p) => p.active && p.profileId) };
  }, [slug, sessionId]);
  useSheetLive(slug, { currentSessionId: sessionId });

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
        <BackLink slug={slug} />
        <ErrorState message={`${t("loadError")} — ${res.state.message}`} />
      </PageContainer>
    );
  }
  if (res.state.kind !== "ok") return null;
  return <SheetForm key={sessionId} slug={slug} sessionId={sessionId} data={res.state.data} />;
}

function BackLink({ slug }: { slug: string }) {
  const t = useTranslations("formSheet.sheet");
  return (
    <Button asChild variant="ghost" size="sm" className="w-fit">
      <Link href={sheetHomePath(slug)}>
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        {t("back")}
      </Link>
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

  const [answers, setAnswers] = React.useState<SheetAnswers>(data.answers);
  const [state, setState] = React.useState<SheetState>(() => initialSheetState(data.answers, firstSection));
  const payload = sheetPayload(state, editableKeys, questions);
  const [savedJson, setSavedJson] = React.useState(() => (data.answers.saved ? JSON.stringify(payload) : ""));
  const dirty = JSON.stringify(payload) !== savedJson;
  const [printing, setPrinting] = React.useState(false);

  const patient = data.answers.suggested?.patient;
  const date = data.answers.suggested?.date;
  const staff = data.staff;
  const nurseOptions =
    state.nurseId && !staff.some((p) => p.id === state.nurseId) && data.answers.suggested?.nurse?.id === state.nurseId
      ? [{ id: state.nurseId, name: data.answers.suggested.nurse.name }]
      : [];

  const problems = sheetProblems(state);
  const reason =
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

  const { submitting, submit } = useSubmit(() => saveSheetAnswers(slug, sessionId, payload, center), {
    successMessage: t("saved"),
    onSuccess: (saved) => {
      setAnswers(saved);
      setSavedJson(JSON.stringify(payload));
    },
  });

  const setField = (key: string, value: string) => setState((s) => ({ ...s, fields: { ...s.fields, [key]: value } }));

  return (
    <PageContainer gap="lg" className="w-full px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
          <BackLink slug={slug} />
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
            {answers.saved && answers.updatedAt
              ? t("savedAt", { when: format.dateTime(new Date(answers.updatedAt), "dateAndTime") })
              : t("notSaved")}
          </span>
          <Button variant="outline" onClick={() => setPrinting(true)}>
            <HugeiconsIcon icon={PrinterIcon} className="size-4" />
            {t("print")}
          </Button>
        </div>
      </div>

      <Panel title={t("header")}>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {editable.map((f) => (
            <Field key={f.clave} label={fieldLabel(f, tr)} htmlFor={`f-${f.clave}`}>
              <Input
                id={`f-${f.clave}`}
                value={state.fields[f.clave] ?? ""}
                onChange={(e) => setField(f.clave, e.target.value)}
                className="h-12 text-base tabular-nums"
                autoComplete="off"
              />
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
          <Field label={t("additionalNotes")} htmlFor="sheet-notes">
            <Textarea
              id="sheet-notes"
              rows={4}
              value={state.additionalNotes}
              onChange={(e) => setState((s) => ({ ...s, additionalNotes: e.target.value }))}
              className="text-base"
            />
          </Field>
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

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <FormFooter
          primary={{ label: t("save"), onClick: () => submit() }}
          reason={reason}
          blocked={!!reason}
          submitting={submitting}
          submittingLabel={t("saving")}
        />
      </div>

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
