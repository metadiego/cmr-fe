"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { HOME_ROUTE } from "@/lib/home-route";
import { safeNextPath } from "@/lib/auth/next-path";

export interface LoginState {
  error?: string;
}

// Server Action: signs in against Supabase using the SERVER client so the
// session cookies are written server-side, then redirects to the validated `next` path (where the
// user was going, e.g. the Claude consent page) or HOME_ROUTE.
// On failure it returns a typed error for the form (useActionState).
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    const t = await getTranslations("login");
    return { error: t("errorEmptyCredentials") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Back to where they were going (validated: an in-app path only), else home.
  // redirect() throws NEXT_REDIRECT — keep it outside any try/catch.
  redirect(safeNextPath(String(formData.get("next") ?? "")) ?? HOME_ROUTE);
}
