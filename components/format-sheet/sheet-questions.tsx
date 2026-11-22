"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import type { AnswerValue } from "@/lib/api/format-answers";
import { answerKey, LIMITS, type AnswerState, type SheetQuestion } from "@/lib/format-sheet/sheet";
import { cn } from "@/lib/utils";

// The checklist on a tablet: one row per question with two big Yes / No toggles (tap again to clear)
// and an optional note. Group bands mirror the paper (1. Hidratación, 2. Alimentación…).
export function SheetQuestions({
  questions,
  answers,
  onChange,
}: {
  questions: SheetQuestion[];
  answers: Record<string, AnswerState>;
  onChange: (key: string, next: AnswerState) => void;
}) {
  const t = useTranslations("formSheet.sheet");
  return (
    <ul className="divide-y">
      {questions.map((q) => {
        const key = answerKey(q);
        const a = answers[key] ?? { value: null, note: "" };
        const set = (value: AnswerValue) => onChange(key, { ...a, value: a.value === value ? null : value });
        return (
          <React.Fragment key={key}>
            {q.groupTitle && (
              <li className="bg-muted/50 px-5 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {q.groupTitle}
              </li>
            )}
            <li className="grid gap-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(12rem,18rem)] md:items-center">
              <p id={`q-${key}`} className="text-base">
                {q.text}
              </p>
              <div className="flex gap-2" role="group" aria-labelledby={`q-${key}`}>
                <Toggle on={a.value === "yes"} tone="yes" onClick={() => set("yes")}>
                  {t("yes")}
                </Toggle>
                <Toggle on={a.value === "no"} tone="no" onClick={() => set("no")}>
                  {t("no")}
                </Toggle>
              </div>
              <Input
                value={a.note}
                onChange={(e) => onChange(key, { ...a, note: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder={t("note")}
                aria-label={`${t("note")} — ${q.text}`}
                maxLength={LIMITS.note + 50}
                className="h-11 text-base"
              />
            </li>
          </React.Fragment>
        );
      })}
    </ul>
  );
}

function Toggle({
  on,
  tone,
  onClick,
  children,
}: {
  on: boolean;
  tone: "yes" | "no";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-11 min-w-16 rounded-lg border px-4 text-base font-medium transition-colors",
        on
          ? tone === "yes"
            ? "border-success-foreground/40 bg-success text-success-foreground"
            : "border-warning-foreground/40 bg-warning text-warning-foreground"
          : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
