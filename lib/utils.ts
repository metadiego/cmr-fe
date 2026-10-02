import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// A path a caller asked us to navigate back to (e.g. a "volver" query param) is untrusted input —
// someone could hand-edit the URL. Only a same-app relative path is safe to use as a redirect target;
// an absolute URL or a protocol-relative one ("//evil.com") would leave the app. Returns null for
// anything else, so the caller falls back to its own default.
export function safeInternalPath(path: string | null | undefined): string | null {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : null
}
