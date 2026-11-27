"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { CallOutgoing02Icon } from "@hugeicons/core-free-icons";

import { getCallcenterCommand, postCallcenterCallback, type Call } from "@/lib/api/callcenter";
import { getStaffExtensions } from "@/lib/api/personal";
import { apiErrorLabel } from "@/lib/api/errors";
import { useMe } from "@/hooks/use-me";
import { useConfirm } from "@/components/kit/confirm-host";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field } from "@/components/kit/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const POLL_MS = 2000;
const TIMEOUT_MS = 60_000;

// Handoff §2: dials a real patient's phone — an outward action (rule 8), so Enter never fires it and
// it always goes through useConfirm(). `callcenter.callback` is brand new and nobody holds it yet
// (the owner decides who does); until then this button simply never renders for anyone.
export function CallcenterCallbackButton({ call }: { call: Call }) {
  const t = useTranslations("callcenter");
  const tRoot = useTranslations();
  const confirm = useConfirm();
  const me = useMe();
  const [ownExtension, setOwnExtension] = React.useState<string | null>(null);
  const [chosen, setChosen] = React.useState(call.extension ?? "");
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Fetched on mount, not lazily on open: the own-vs-call-extension CHOICE decides whether a picker
  // renders at all, so it must be known before that decision, not after the user has already clicked
  // a plain button with no picker.
  React.useEffect(() => {
    if (me.kind !== "ok" || !me.me.staffId) return;
    let active = true;
    getStaffExtensions(me.me.staffId)
      .then((exts) => {
        if (!active) return;
        const mine = exts.find((e) => e.pbx === call.pbx)?.extension ?? null;
        setOwnExtension(mine);
      })
      .catch(() => active && setOwnExtension(null));
    return () => {
      active = false;
    };
  }, [me, call.pbx]);

  const options = [...new Set([call.extension, ownExtension].filter((x): x is string => !!x))];

  async function fire() {
    const ok = await confirm({
      title: t("callbackConfirmTitle"),
      description: t("callbackConfirmBody", { number: call.from ?? "", extension: chosen || call.extension || "" }),
      confirmLabel: t("callbackConfirm"),
    });
    if (!ok) return;
    setOpen(false);
    setBusy(true);
    try {
      const r = await postCallcenterCallback(call.id, chosen || undefined);
      const toastId = toast(t("callbackDialing", { number: r.number, extension: r.extension }));
      const startedAt = Date.now();
      for (;;) {
        await new Promise((res) => setTimeout(res, POLL_MS));
        const cmd = await getCallcenterCommand(r.id);
        if (cmd.status === "done") {
          toast.success(t("callbackDone"), { id: toastId });
          return;
        }
        if (cmd.status === "failed") {
          toast.error(cmd.error || t("callbackFailed"), { id: toastId });
          return;
        }
        if (Date.now() - startedAt > TIMEOUT_MS) {
          toast.error(t("callbackTimeout"), { id: toastId });
          return;
        }
      }
    } catch (err) {
      toast.error(apiErrorLabel(err, tRoot));
    } finally {
      setBusy(false);
    }
  }

  if (options.length > 1) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <HugeiconsIcon icon={CallOutgoing02Icon} className="size-3.5" />
            {t("callback")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3">
          <Field label={t("callbackExtension")} htmlFor="cc-callback-ext">
            <Select value={chosen || options[0]} onValueChange={setChosen}>
              <SelectTrigger id="cc-callback-ext"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((ext) => (
                  <SelectItem key={ext} value={ext}>
                    {ext === ownExtension ? t("callbackExtensionMine", { extension: ext }) : t("callbackExtensionCall", { extension: ext })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button size="sm" className="w-full" onClick={fire}>{t("callbackConfirm")}</Button>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={fire}>
      <HugeiconsIcon icon={CallOutgoing02Icon} className="size-3.5" />
      {t("callback")}
    </Button>
  );
}
