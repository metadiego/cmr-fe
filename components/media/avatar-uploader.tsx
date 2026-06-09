"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useMe } from "@/hooks/use-me";
import { uploadMedia, setAvatar, deleteAvatar } from "@/lib/api/media";
import { apiErrorMessage } from "@/lib/api/errors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// Avatar upload/remove. Uploads the file directly to storage, then PUT /me/avatar.
export function AvatarUploader() {
  const t = useTranslations("appearance");
  const me = useMe();
  const avatarUrl = me.kind === "ok" ? me.me.avatarUrl : null;
  const email = me.kind === "ok" ? me.me.email : null;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const initials = (email ?? "?").slice(0, 2).toUpperCase();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadMedia("avatar", file);
      await setAvatar(url);
      toast.success(t("avatarSaved"));
      window.location.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await deleteAvatar();
      toast.success(t("avatarRemoved"));
      window.location.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onFile}
        />
        <Button
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? t("uploading") : t("avatarUpload")}
        </Button>
        {avatarUrl && (
          <Button size="sm" variant="outline" onClick={onRemove} disabled={busy}>
            {t("avatarRemove")}
          </Button>
        )}
      </div>
    </div>
  );
}
