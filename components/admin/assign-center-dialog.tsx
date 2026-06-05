"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { assignCenter, type Perfil } from "@/lib/api/profiles";
import { getCenters, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Shared dialog to assign a center to a profile. Used post-invite and from a
// user row. Loads the centers list lazily when opened.
export function AssignCenterDialog({
  profile,
  open,
  onOpenChange,
  onAssigned,
}: {
  profile: Perfil | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: () => void;
}) {
  const t = useTranslations("admin.assign");
  const tc = useTranslations("admin");
  const [centers, setCenters] = React.useState<Centro[] | null>(null);
  const [centroId, setCentroId] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  // Effect only fetches (async setState); resets happen on close in the handler.
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    getCenters()
      .then((list) => active && setCenters(list))
      .catch((err) => active && toast.error(apiErrorMessage(err)));
    return () => {
      active = false;
    };
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCenters(null);
      setCentroId("");
    }
    onOpenChange(next);
  }

  async function onSubmit() {
    if (!profile || !centroId) return;
    setSubmitting(true);
    try {
      await assignCenter(profile.id, { centroId });
      toast.success(t("success", { email: profile.email }));
      handleOpenChange(false);
      onAssigned?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { email: profile?.email ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {centers !== null && centers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCenters")}</p>
        ) : (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("center")}</label>
            <Select value={centroId} onValueChange={setCentroId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("center")} />
              </SelectTrigger>
              <SelectContent>
                {(centers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} ({c.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !centroId}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
