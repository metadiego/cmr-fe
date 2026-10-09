"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { buildHubCredentialsUrl } from "@/lib/print/hub-target";
import { saveMachineLogin } from "@/lib/print/hub-credentials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  hubUrl: string | undefined;
  host: string;
  centerId: string;
  // true: the PC refused the hub (open, with the steps); false: offered collapsed, to replace a login.
  required: boolean;
  onSaved: (printers: string[]) => void;
}

// The login of a Windows cashier PC, handed to the hub from here so nobody edits files on the server.
// Windows refuses network printing without a user of that PC, and an owner who signs in with a
// Microsoft account and PIN has no usable password: hence a local "cmrprint" user, made once per PC.
export function PrintHubLogin({ hubUrl, host, centerId, required, onSaved }: Props) {
  const t = useTranslations("aparienciaCorporativa");
  const [open, setOpen] = React.useState(required);
  const [username, setUsername] = React.useState("cmrprint");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const url = buildHubCredentialsUrl(hubUrl, host);

  async function save() {
    if (!url) return;
    setBusy(true);
    setError(null);
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusy(false);
      return setError(t("loginNoSession"));
    }
    const r = await saveMachineLogin(url, { username: username.trim(), password }, { token, centerId });
    setBusy(false);
    if (r.ok) {
      setPassword("");
      setOpen(false);
      toast.success(t("loginSaved", { host }));
      return onSaved(r.printers);
    }
    setError(r.reason === "rejected" ? t("loginRejected") : r.reason === "forbidden" ? t("loginForbidden", { detail: r.detail }) : t("loginError", { detail: r.detail }));
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium underline underline-offset-2">
        {t("loginChange")}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-3 text-xs">
      <p className="font-medium">{required ? t("loginNeeded", { host }) : t("loginTitle", { host })}</p>
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>{t("loginStep1")}</li>
        <li>{t("loginStep2")}</li>
        <li>{t("loginStep3")}</li>
      </ol>
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="ph-login-user">{t("loginUser")}</Label>
          <Input id="ph-login-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ph-login-pass">{t("loginPassword")}</Label>
          <Input id="ph-login-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <Button type="button" size="sm" onClick={save} disabled={busy || !url || !username.trim() || !password}>
          {busy ? t("loginSaving") : t("loginSave")}
        </Button>
      </div>
      <p className="text-muted-foreground">{t("loginPrivacy")}</p>
      {error && <p className="text-destructive" role="alert">{error}</p>}
    </div>
  );
}
