"use client";

import * as React from "react";

import { useCreateClinic } from "@/hooks/use-create-clinic";
import { isClinicViewAll } from "@/lib/tenant";
import { CreateClinicField } from "@/components/kit/create-clinic-field";

// For a create UI that works inside ONE clinic but is opened without one (docs/specs/
// selector-de-centros-arriba.md). With a `clinicId`, or with one clinic in the top bar, it renders the UI
// as it always did (`undefined` = the top bar's clinic). On «Ambos» it first asks which clinic
// (`CreateClinicField`, empty, required) and renders the UI only once one is picked, remounted per clinic
// so nothing typed for one clinic is sent to another.
export function CreateClinicGate({
  permission,
  clinicId,
  children,
}: {
  /** The create permission: only clinics where the person holds it are offered. */
  permission: string;
  clinicId?: string;
  children: (clinicId: string | undefined) => React.ReactNode;
}) {
  if (clinicId || !isClinicViewAll()) return <>{children(clinicId)}</>;
  return <AskClinic permission={permission}>{children}</AskClinic>;
}

function AskClinic({
  permission,
  children,
}: {
  permission: string;
  children: (clinicId: string) => React.ReactNode;
}) {
  const create = useCreateClinic(permission, null);
  const [picked, setPicked] = React.useState("");
  const chosen = picked || create.defaultClinicId;
  return (
    <div className="grid gap-4">
      <CreateClinicField centers={create.centers} value={chosen} onChange={setPicked} show />
      {chosen ? <React.Fragment key={chosen}>{children(chosen)}</React.Fragment> : null}
    </div>
  );
}
