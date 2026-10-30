import { redirect } from "next/navigation";

import { ADMIN_TABS, isTab } from "@/lib/nav/tab-routes";

// A tab of /admin (the screen is ../layout.tsx). An unknown segment goes to the default tab instead of
// rendering that tab's screen under a URL that names nothing.
export default async function AdminTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (!isTab(ADMIN_TABS, tab)) redirect("/admin");
  return null;
}
