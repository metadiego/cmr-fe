"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiErrorMessage } from "@/lib/api/errors";

// Consolidated cash count, for caja.ver_todos only: says which figure is in use — the manager's ONE
// count of the whole drawer, or the sum of the cashiers' counts — and switches between them (owner,
// 04-nov-2026). Going back to the sum sends an empty count; the BE then sums the cashiers again.
export function ConsolidatedCountBar({
  counting,
  onCount,
  backToSum,
}: {
  counting: boolean;
  onCount: () => void;
  backToSum: () => Promise<void>;
}) {
  const t = useTranslations("caja.count");
  const [busy, setBusy] = React.useState(false);

  const confirmBack = () =>
    toast(t("backToSumConfirm"), {
      action: {
        label: t("backToSum"),
        onClick: async () => {
          setBusy(true);
          try {
            await backToSum();
          } catch (err) {
            toast.error(apiErrorMessage(err));
          } finally {
            setBusy(false);
          }
        },
      },
    });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-4 py-2.5 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={counting ? "default" : "secondary"}>
          {counting ? t("managerCount") : t("cashiersSum")}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {counting ? t("managerCountHint") : t("cashiersSumHint")}
        </span>
      </div>
      {counting ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={confirmBack}>
          {t("backToSum")}
        </Button>
      ) : (
        <Button size="sm" onClick={onCount}>
          {t("countMyself")}
        </Button>
      )}
    </div>
  );
}
