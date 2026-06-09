"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const SET_PASSWORD = "/auth/set-password";
const AUTH_LINK = /[#&](access_token=|type=(invite|recovery))/;

// Supabase invite/recovery email links sometimes land on the Site URL (root)
// instead of the requested redirect_to. If we detect an invite/recovery token in
// the URL on any page other than /auth/set-password, bounce there preserving the
// token (the hash). Captures the hash at first render, before @supabase/ssr
// processes and clears it. Mounted high in the root layout.
export function RecoveryRedirect() {
  const pathname = usePathname();
  const [authHash] = React.useState(() => {
    if (typeof window === "undefined") return null;
    return AUTH_LINK.test(window.location.hash) ? window.location.hash : null;
  });

  React.useEffect(() => {
    if (authHash && pathname !== SET_PASSWORD) {
      window.location.replace(SET_PASSWORD + authHash);
    }
  }, [authHash, pathname]);

  return null;
}
