import { redirect } from "next/navigation";

import { HOME_ROUTE } from "@/lib/home-route";

// "/" has no page of its own: it opens home (the Patient Care board). Anonymous visitors never
// get here — proxy.ts sends them to /login first.
export default function RootPage() {
  redirect(HOME_ROUTE);
}
