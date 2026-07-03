"use client";

import { NextIntlClientProvider, IntlErrorCode, type AbstractIntlMessages } from "next-intl";

import { humanizeKey } from "@/lib/i18n/humanize";

// Client wrapper for NextIntlClientProvider. Inside a client boundary the
// provider can't infer locale/messages from the server context, so the server
// layout passes them explicitly. Adds graceful handling of missing keys
// (onError/getMessageFallback are functions → can't cross the RSC boundary):
// missing i18n keys render a humanized fallback silently, so config-only boards
// (new verticals) read fine without FE translations.
export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="America/Puerto_Rico"
      onError={(error) => {
        if (error.code !== IntlErrorCode.MISSING_MESSAGE) console.error(error);
      }}
      getMessageFallback={({ key }) => humanizeKey(key)}
    >
      {children}
    </NextIntlClientProvider>
  );
}
