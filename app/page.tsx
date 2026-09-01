import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { ApiHealthCheck } from "@/components/api-health-check";

export default async function Page() {
  const t = await getTranslations("landing");

  return (
    <div className="relative overflow-hidden">
      {/* Soft indigo glow — subtle in light mode, luminous on the deep-indigo dark theme. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -z-10 h-72 w-[44rem] max-w-full -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
      />

      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {t("badge")}
        </span>

        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>

        <p className="max-w-xl leading-relaxed text-balance text-muted-foreground">
          {t("subtitle")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/login">{t("signIn")}</Link>
          </Button>
          <Button size="lg" variant="outline">
            {t("viewComponents")}
          </Button>
        </div>

        <ApiHealthCheck />
      </section>
    </div>
  );
}
