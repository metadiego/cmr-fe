"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Stethoscope02Icon } from "@hugeicons/core-free-icons"

import { createClient } from "@/lib/supabase/client"
import { useMe } from "@/hooks/use-me"
import { Button } from "@/components/ui/button"
import {
  canApprove,
  consentStep,
  redirectHost,
  type ConsentDetails,
} from "@/lib/oauth/consent"

// Consent page of Supabase Auth's OAuth 2.1 server: Claude (or another MCP client) asks to act in
// CMR as the signed-in user. Supabase redirects here with `authorization_id`; this page approves or
// denies, and Supabase sends the user back to the client. Grants nothing by itself: what Claude may
// do is the user's own permissions, decided by the API. See docs/specs/mcp-connector-consent-page.md.
export default function OAuthConsentPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <Consent />
    </Suspense>
  )
}

type View =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "consent"; details: ConsentDetails }

function Consent() {
  const t = useTranslations("oauthConsent")
  const tPending = useTranslations("pending")
  const authorizationId = useSearchParams().get("authorization_id")
  const me = useMe()
  const [view, setView] = useState<View>({ kind: "loading" })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!authorizationId) return
    let active = true
    createClient()
      .auth.oauth.getAuthorizationDetails(authorizationId)
      .then(({ data, error }) => {
        if (!active) return
        const step = error ? { kind: "error" as const } : consentStep(data)
        // Already approved for this client: straight back to it.
        if (step.kind === "redirect") window.location.assign(step.url)
        else setView(step.kind === "consent" ? step : { kind: "error" })
      })
      .catch(() => active && setView({ kind: "error" }))
    return () => {
      active = false
    }
  }, [authorizationId])

  async function decide(approve: boolean) {
    if (!authorizationId || busy) return
    setBusy(true)
    const oauth = createClient().auth.oauth
    // Without skipBrowserRedirect, Supabase sends the browser back to the client itself.
    const { error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId)
    if (error) {
      setBusy(false)
      setView({ kind: "error" })
    }
  }

  async function signOut() {
    await createClient().auth.signOut()
    const here = `${window.location.pathname}${window.location.search}`
    window.location.assign(`/login?next=${encodeURIComponent(here)}`)
  }

  // A pending, rejected or suspended account cannot hand its access to Claude. A suspended one
  // cannot even read /auth/me (the API answers 403), so "could not load the account" blocks too.
  const status = me.kind === "ok" ? me.me.status : null
  // No authorization_id in the link: nothing to ask Supabase about.
  const shown: View | { kind: "invalid" } = authorizationId
    ? view
    : { kind: "invalid" }
  const blocked =
    me.kind === "fail" || (me.kind === "ok" && !canApprove(status))
  const blockedMessage =
    status === "pendiente"
      ? tPending("waiting")
      : status === "rechazado"
        ? tPending("rejected")
        : tPending("suspended")

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-muted px-6 py-12">
      <div className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <HugeiconsIcon icon={Stethoscope02Icon} className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">CMR</span>
      </div>

      <div className="w-full max-w-md rounded-md bg-card p-6 shadow-sm ring-1 shadow-[rgba(16,32,64,0.06)] ring-foreground/10">
        {shown.kind === "loading" ||
        (shown.kind === "consent" && me.kind === "loading") ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : shown.kind === "invalid" || shown.kind === "error" ? (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold tracking-tight">
              {t(shown.kind === "invalid" ? "invalidLink" : "genericError")}
            </h1>
            <Button
              variant="outline"
              onClick={() => window.location.assign("/")}
            >
              {t("backToCmr")}
            </Button>
          </div>
        ) : (
          <ConsentCard
            details={shown.details}
            blocked={blocked}
            blockedMessage={blockedMessage}
            busy={busy}
            onApprove={() => decide(true)}
            onDeny={() => decide(false)}
            onSignOut={signOut}
          />
        )}
      </div>
    </div>
  )
}

function ConsentCard(props: {
  details: ConsentDetails
  blocked: boolean
  blockedMessage: string
  busy: boolean
  onApprove: () => void
  onDeny: () => void
  onSignOut: () => void
}) {
  const t = useTranslations("oauthConsent")
  const { details } = props
  const client = details.client.name || t("unknownClient")
  const host = redirectHost(details.redirect_uri)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {details.client.logo_uri ? (
          // eslint-disable-next-line @next/next/no-img-element -- the client's logo lives on its own host, unknown in advance (next/image needs configured domains)
          <img
            src={details.client.logo_uri}
            alt=""
            className="size-10 shrink-0 rounded-lg ring-1 ring-foreground/10"
          />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-lg font-semibold">
            {client.slice(0, 1).toUpperCase()}
          </span>
        )}
        <h1 className="text-xl font-semibold tracking-tight">
          {t("title", { client })}
        </h1>
      </div>

      <p className="text-sm">
        {t("signedInAs")}{" "}
        <span className="font-medium">{details.user.email}</span>{" "}
        <button
          type="button"
          onClick={props.onSignOut}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("notYou")}
        </button>
      </p>

      <div className="space-y-2 rounded-md bg-muted/60 px-4 py-3 text-sm">
        <p>{t("whatItCanDo", { client })}</p>
        <p className="text-muted-foreground">{t("auditNote", { client })}</p>
      </div>

      {host && (
        <p className="text-sm text-muted-foreground">
          {t("returnTo")}{" "}
          <span className="font-medium text-foreground">{host}</span>
        </p>
      )}

      {props.blocked && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {props.blockedMessage}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={props.onDeny} disabled={props.busy}>
          {t("deny")}
        </Button>
        {!props.blocked && (
          <Button onClick={props.onApprove} disabled={props.busy}>
            {props.busy ? t("working") : t("approve")}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("disconnectHint", { client })}
      </p>
    </div>
  )
}
