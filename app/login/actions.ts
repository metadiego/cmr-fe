"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

// Server Action: signs in against Supabase using the SERVER client so the
// session cookies are written server-side, then redirects to the dashboard.
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

  // redirect() throws NEXT_REDIRECT — keep it outside any try/catch.
  // Al entrar se aterriza en el INICIO (/dashboard), una página EN BLANCO como el legacy — NO en un
  // módulo de trabajo. Nada de suponer en qué trabaja cada quien y mandarlo ahí.
  redirect("/dashboard");
}
