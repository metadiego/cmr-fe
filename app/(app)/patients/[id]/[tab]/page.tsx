import { redirect } from "next/navigation";

import { PATIENT_TABS, isTab } from "@/lib/nav/tab-routes";

// A tab of the patient record (/patients/<id>/billing, …; the screen is ../layout.tsx). An unknown
// segment goes to the record itself instead of rendering it under a URL that names no tab.
export default async function PatientTabPage({ params }: { params: Promise<{ id: string; tab: string }> }) {
  const { id, tab } = await params;
  if (!isTab(PATIENT_TABS, tab)) redirect(`/patients/${id}`);
  return null;
}
