"use client";

import * as React from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { QrCode01Icon, SentIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/kit/field";
import { FormDialog } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { sendSheetToUser } from "@/lib/api/format-answers";
import { listPersonalAll, type PersonalEnAlcance } from "@/lib/api/personal";
import { missingFields } from "@/lib/forms/missing";
import { sheetPath } from "@/lib/format-sheet/sheet";

// Above a fillable sheet in the formats modal (patient-desk row → GLP-1): open it on this screen, show
// its QR for the iPad camera, or «Enviar al iPad» (the sheet opens by itself where that person is signed
// in — the BE publishes it on the center's live bus).
export function SheetSendBar({ slug, sessionId, center }: { slug: string; sessionId: string; center?: string }) {
  const t = useTranslations("formSheet.send");
  const { can } = useCan();
  const [qrOpen, setQrOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const path = sheetPath(slug, sessionId);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
      <Button asChild size="sm">
        <Link href={path}>{t("fill")}</Link>
      </Button>
      <Button size="sm" variant="outline" onClick={() => setQrOpen(true)}>
        <HugeiconsIcon icon={QrCode01Icon} className="size-4" />
        {t("qr")}
      </Button>
      {can("formats.send") && (
        <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}>
          <HugeiconsIcon icon={SentIcon} className="size-4" />
          {t("toIpad")}
        </Button>
      )}
      <QrDialog open={qrOpen} onOpenChange={setQrOpen} path={path} />
      {sendOpen && <SendDialog open onOpenChange={setSendOpen} slug={slug} sessionId={sessionId} center={center} />}
    </div>
  );
}

function QrDialog({ open, onOpenChange, path }: { open: boolean; onOpenChange: (o: boolean) => void; path: string }) {
  const t = useTranslations("formSheet.send");
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    QRCode.toDataURL(`${window.location.origin}${path}`, { width: 320, margin: 1 }).then(
      (url) => alive && setSrc(url),
      () => alive && setSrc(null),
    );
    return () => {
      alive = false;
    };
  }, [open, path]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("qrTitle")}</DialogTitle>
          <DialogDescription>{t("qrHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          {src ? (
            // A data: URL generated here; next/image adds nothing for it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={t("qrTitle")} width={320} height={320} className="rounded-lg bg-white p-2" />
          ) : (
            <div className="size-80 animate-pulse rounded-lg bg-muted" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const fullName = (p: PersonalEnAlcance) => [p.name, p.lastName].filter(Boolean).join(" ");

function SendDialog({
  open,
  onOpenChange,
  slug,
  sessionId,
  center,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  slug: string;
  sessionId: string;
  center?: string;
}) {
  const t = useTranslations("formSheet.send");
  const staffRes = useResource<PersonalEnAlcance[]>(
    async () => (await listPersonalAll({}, center)).filter((p) => p.active && p.profileId),
    [center],
  );
  const staff = staffRes.state.kind === "ok" ? staffRes.state.data : [];
  const [form, setForm] = useDialogForm(() => ({ to: "" }), open, sessionId);
  const missing = missingFields([[t("to"), !!form.to]]);
  const { submitting, submit } = useSubmit(() => sendSheetToUser(slug, sessionId, form.to, center), {
    onSuccess: () => {
      const who = staff.find((p) => p.id === form.to);
      toast.success(t("sent", { name: who ? fullName(who) : "—" }));
      onOpenChange(false);
    },
  });
  const loading = staffRes.state.kind === "loading";
  const reason = staffRes.state.kind === "fail" ? staffRes.state.message : !loading && staff.length === 0 ? t("noStaff") : null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t("sendTitle")}
      // Outward action: only the button sends (rule 8), Enter does not.
      onSubmit={() => {}}
      actions={[{ label: t("send"), onClick: () => submit() }]}
      submitting={submitting}
      missing={missing}
      reason={reason}
      blocked={!!reason}
    >
      <Field label={t("to")} htmlFor="sheet-send-to" required hint={t("toHint")}>
        <Select value={form.to || undefined} onValueChange={(v) => setForm({ to: v })} disabled={loading}>
          <SelectTrigger id="sheet-send-to" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {staff.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {fullName(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}
