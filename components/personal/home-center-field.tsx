"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { setHomeCenter } from "@/lib/api/personal";
import { homeCenterChoice } from "@/lib/personal/home-center";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveSection } from "@/components/personal/save-group";

type Center = { id: string; name: string; active?: boolean };

// «Centro de origen» of a staff record (cmr-be docs/specs/staff-home-center.md): the record's center
// (lists, clinicName). Not where they work each day (that is the agenda) nor what they can open (the
// access role). The BE needs staff.update at the current home AND the new one; sent only on change,
// with the record's single "Save".
export function HomeCenterField({
  staffId,
  current,
  centers,
  editable,
}: {
  staffId: string;
  current: string;
  centers: Center[];
  /** Center ids where the viewer holds staff.update. */
  editable: ReadonlySet<string>;
}) {
  const t = useTranslations("homeCenter");
  const [picked, setPicked] = React.useState(current);
  // What is saved: `current` until the list refresh brings the new home, the picked one right after a save.
  const [saved, setSaved] = React.useState(current);
  const { options, blocked } = homeCenterChoice(centers, current, editable);

  useSaveSection("home-center", picked !== saved, async () => {
    await setHomeCenter(staffId, picked, saved);
    setSaved(picked);
  });

  return (
    <div className="grid gap-1.5 sm:max-w-xs">
      <Label htmlFor={`home-${staffId}`}>{t("label")}</Label>
      <Select value={picked} onValueChange={setPicked} disabled={blocked !== null}>
        <SelectTrigger id={`home-${staffId}`} className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{blocked ? t(`blocked.${blocked}`) : t("help")}</p>
    </div>
  );
}
