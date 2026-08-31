import { Geist, Geist_Mono } from "next/font/google"
import { getLocale, getMessages } from "next-intl/server"

import "./globals.css"
import { IntlProvider } from "@/components/intl-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { PresentationProvider } from "@/components/presentation-provider"
import { RecoveryRedirect } from "@/components/auth/recovery-redirect"
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] })

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Locale + messages resolved from the request config (cookie-based). Passed
  // explicitly because IntlProvider is a client boundary (can't infer them).
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("antialiased", geistMono.variable, "font-sans", geistSans.variable)}
    >
      <body>
        {/* Inherits locale + messages from the request config; adds graceful
            fallback for missing keys (humanized) for config-only boards. */}
        <IntlProvider locale={locale} messages={messages}>
          <RecoveryRedirect />
          <ThemeProvider>
            <PresentationProvider>
              <AppShell>{children}</AppShell>
              <Toaster />
            </PresentationProvider>
          </ThemeProvider>
        </IntlProvider>
      </body>
    </html>
  )
}
