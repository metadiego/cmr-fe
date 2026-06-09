import { apiFetch } from "./client";

// Profile media (Supabase Storage + signed URLs). The FE mints an upload URL,
// PUTs the file DIRECTLY to storage (no Bearer/envelope), then saves the public
// URL (avatar → /me/avatar; background/logo → preferences config).

export type MediaKind = "avatar" | "background" | "logo";

export interface UploadUrl {
  kind: MediaKind;
  uploadUrl: string;
  publicUrl: string;
  path: string;
}

// Client-side limits (mirror the BE bucket rules; the BE re-validates).
export const MEDIA_LIMITS: Record<MediaKind, { maxBytes: number; types: RegExp }> = {
  avatar: { maxBytes: 5 * 1024 * 1024, types: /^image\// },
  background: { maxBytes: 50 * 1024 * 1024, types: /^(image\/|video\/(mp4|webm))/ },
  logo: { maxBytes: 5 * 1024 * 1024, types: /^image\// },
};

function getUploadUrl(
  kind: MediaKind,
  contentType: string,
  ext?: string,
): Promise<UploadUrl> {
  return apiFetch<UploadUrl>(`/media/upload-url`, {
    method: "POST",
    body: JSON.stringify({ kind, contentType, ext }),
  });
}

// PUT the file straight to the signed storage URL (raw fetch — the token is in
// the URL; no API envelope here).
async function uploadFile(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}

// Validate + mint + upload; returns the public URL to persist.
export async function uploadMedia(kind: MediaKind, file: File): Promise<string> {
  const limit = MEDIA_LIMITS[kind];
  if (!limit.types.test(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  }
  if (file.size > limit.maxBytes) {
    throw new Error(
      `File too large (max ${Math.round(limit.maxBytes / 1024 / 1024)}MB)`,
    );
  }
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()
    : undefined;
  const { uploadUrl, publicUrl } = await getUploadUrl(kind, file.type, ext);
  await uploadFile(uploadUrl, file);
  return publicUrl;
}

export function setAvatar(avatarUrl: string): Promise<unknown> {
  return apiFetch(`/me/avatar`, {
    method: "PUT",
    body: JSON.stringify({ avatarUrl }),
  });
}

export function deleteAvatar(): Promise<void> {
  return apiFetch<void>(`/me/avatar`, { method: "DELETE" });
}
