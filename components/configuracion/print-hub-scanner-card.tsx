"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createScanner, deleteScanner, updateScanner, type PrintHubScanner, type ScannerSource } from "@/lib/api/print-hub";
import { apiErrorLabel } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Form {
  name: string;
  esclUrl: string;
  defaultSource: ScannerSource;
  active: boolean;
}

const fromScanner = (s: PrintHubScanner | null): Form =>
  s ? { name: s.name, esclUrl: s.esclUrl, defaultSource: s.defaultSource, active: s.active } : { name: "", esclUrl: "", defaultSource: "adf", active: true };

interface Props {
  centerId: string;
  // null = a new scanner not saved yet.
  scanner: PrintHubScanner | null;
  sortOrder: number;
  canEdit: boolean;
  canDelete: boolean;
  onSaved: (s: PrintHubScanner) => void;
  onDeleted: () => void;
}

// Un escáner del centro (BE PR #586, handoff .personal/handoff-escanear-al-cuadre.md): su nombre (lo
// que se elige al pulsar «Escanear» en el cuadre) y su URL eSCL (p. ej. la Xerox de Caguas,
// https://192.130.80.164/eSCL). `documentFormat` se deja en su default (application/pdf-a): no hay
// pedido de cambiarlo pantalla por pantalla.
export function PrintHubScannerCard({ centerId, scanner, sortOrder, canEdit, canDelete, onSaved, onDeleted }: Props) {
  const t = useTranslations("aparienciaCorporativa");
  const tRoot = useTranslations();
  const [form, setForm] = React.useState<Form>(() => fromScanner(scanner));
  const [busy, setBusy] = React.useState<"save" | "delete" | null>(null);

  const setField = (k: "name" | "esclUrl") => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const complete = !!form.name.trim() && !!form.esclUrl.trim();
  const dirty = JSON.stringify(form) !== JSON.stringify(fromScanner(scanner));
  const id = scanner?.id ?? "new";

  async function save() {
    setBusy("save");
    const body = { name: form.name.trim(), esclUrl: form.esclUrl.trim(), defaultSource: form.defaultSource, active: form.active, sortOrder };
    try {
      const saved = scanner ? await updateScanner(centerId, scanner.id, body) : await createScanner(centerId, body);
      toast.success(t("scannerSaved", { name: saved.name }));
      onSaved(saved);
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!scanner) return onDeleted();
    if (!window.confirm(t("scannerRemoveConfirm", { name: scanner.name }))) return;
    setBusy("delete");
    try {
      await deleteScanner(centerId, scanner.id);
      toast.success(t("scannerRemoved", { name: scanner.name }));
      onDeleted();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <fieldset disabled={!canEdit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor={`sn-${id}`}>{t("scannerName")}</Label>
            <Input id={`sn-${id}`} value={form.name} onChange={setField("name")} placeholder={t("scannerNamePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`su-${id}`}>{t("scannerUrl")}</Label>
            <Input id={`su-${id}`} value={form.esclUrl} onChange={setField("esclUrl")} placeholder={t("scannerUrlPlaceholder")} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={`ss-${id}`}>{t("scannerDefaultSource")}</Label>
            <Select value={form.defaultSource} onValueChange={(v) => setForm((f) => ({ ...f, defaultSource: v as ScannerSource }))}>
              <SelectTrigger id={`ss-${id}`} size="sm" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="adf">{t("scannerSourceAdf")}</SelectItem>
                <SelectItem value="platen">{t("scannerSourcePlaten")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            {t("scannerActive")}
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button size="sm" onClick={save} disabled={busy !== null || !complete || (!!scanner && !dirty)}>
            {busy === "save" ? t("saving") : scanner ? t("scannerSave") : t("scannerCreate")}
          </Button>
        )}
        {(canDelete || !scanner) && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={busy !== null}>
            {busy === "delete" ? t("saving") : scanner ? t("scannerRemove") : t("printerDiscard")}
          </Button>
        )}
      </div>
    </div>
  );
}
