"use client";

import { NextIntlClientProvider, IntlErrorCode } from "next-intl";

import { humanizeKey } from "@/lib/i18n/humanize";

// Client wrapper for NextIntlClientProvider that adds graceful handling of
// missing keys (onError/getMessageFallback are functions → can't be passed from
// the server layout). Inherits locale/messages from the server request config.
// Missing i18n keys render a humanized fallback silently, so config-only boards
// (new verticals) read fine without FE translations.
export function IntlProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider
      onError={(error) => {
        if (error.code !== IntlErrorCode.MISSING_MESSAGE) console.error(error);
      }}
      getMessageFallback={({ key }) => humanizeKey(key)}
    >
      {children}
    </NextIntlClientProvider>
  );
}
