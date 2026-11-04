"use client";

import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// The clinic a new record lands in, inside a create dialog of a list that spans clinics (hooks/
// use-create-clinic.ts). A picker when the person may create in more than one clinic; the name alone when
// only one but the screen shows several (`show`), so it is never a surprise; nothing otherwise.
export function CreateClinicField({
  centers,
  value,
  onChange,
  show,
  disabled,
}: {
  centers: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  /** The screen shows more than one clinic: say where it lands even without a choice. */
  show: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("createClinic");
  if (centers.length === 0 || (centers.length === 1 && !show)) return null;
  return (
    <div className="grid gap-1.5">
      <Label>{t("label")}</Label>
      {centers.length > 1 ? (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="w-full"><SelectValue placeholder={t("placeholder")} /></SelectTrigger>
          <SelectContent>
            {centers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm">{centers[0].name}</p>
      )}
      <p className="text-xs text-muted-foreground">{t("help")}</p>
    </div>
  );
}
