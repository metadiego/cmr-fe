import { redirect } from "next/navigation";

import { AUDIT_TABS, isTab } from "@/lib/nav/tab-routes";

// A tab of /configuration/audit (the screen is ../layout.tsx). An unknown segment goes to the
// default tab instead of rendering that tab's screen under a URL that names nothing.
export default async function AuditTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (!isTab(AUDIT_TABS, tab)) redirect("/configuration/audit");
  return null;
}
