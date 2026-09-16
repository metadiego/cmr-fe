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
}

// Cookie-based i18n (no URL routing). Explicit path because this repo has no
// src/ dir — the request config lives at ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

export default withNextIntl(nextConfig)
