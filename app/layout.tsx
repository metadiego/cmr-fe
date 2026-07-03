import { Geist_Mono, Public_Sans } from "next/font/google"
import { getLocale, getMessages } from "next-intl/server"

import "./globals.css"
import { IntlProvider } from "@/components/intl-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { PresentationProvider } from "@/components/presentation-provider"
import { RecoveryRedirect } from "@/components/auth/recovery-redirect"
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const publicSans = Public_Sans({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
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
      className={cn("antialiased", fontMono.variable, "font-sans", publicSans.variable)}
    >
      <body>
        {/* Inherits locale + messages from the request config; adds graceful
            fallback for missing keys (humanized) for config-only boards. */}
        <IntlProvider locale={locale} messages={messages}>
          <RecoveryRedirect />
          <ThemeProvider>
            <PresentationProvider>
              <SiteHeader />
              <main>{children}</main>
              <Toaster />
            </PresentationProvider>
          </ThemeProvider>
        </IntlProvider>
      </body>
    </html>
  )
}
