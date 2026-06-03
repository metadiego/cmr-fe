import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const nextConfig: NextConfig = {}

// Cookie-based i18n (no URL routing). Explicit path because this repo has no
// src/ dir — the request config lives at ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

export default withNextIntl(nextConfig)
