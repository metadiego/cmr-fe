import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

// Build marker: inlined at build time so the running page can say WHICH build it serves.
// On Vercel the deploy provides VERCEL_GIT_COMMIT_SHA; locally it falls back to "dev".
// Lets anyone confirm in a glance whether the browser is on the fixed bundle (handoff
// atencion-la-segunda-casilla-deshace-la-primera: "pongan una marca de versión").
const buildSha = (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7)

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
  // Billing screens that became tabs (lib/nav/tab-routes.ts) keep their old URLs working: bookmarks
  // and any menu catalog row still pointing there land on the tab. (/billing/consultations/returns
  // needs no redirect: it IS the tab's path now.) Not permanent, so the routes can still change.
  async redirects() {
    return [
      { source: "/billing/returns", destination: "/billing/invoices/returns", permanent: false },
      { source: "/billing/cash/general", destination: "/billing/invoices/cash", permanent: false },
      { source: "/billing/cash/consultation", destination: "/billing/consultations/cash", permanent: false },
      { source: "/reports/daily", destination: "/billing/invoices/stats", permanent: false },
    ]
  },
}

// Cookie-based i18n (no URL routing). Explicit path because this repo has no
// src/ dir — the request config lives at ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

export default withNextIntl(nextConfig)
