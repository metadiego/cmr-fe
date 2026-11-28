// Pure display logic for "Compras y devoluciones" (handoff kardex-compras-y-devoluciones, 28-nov-2026),
// shared by the screen and its CSV export so both agree word for word.
import type { KardexPurchaseChannel, KardexPurchaseLine, KardexPurchasesRefunds } from "../api/inventory-kardex.ts";

type T = (key: string, values?: Record<string, string | number>) => string;

// "Directa" / "En kit «nombre»" / "Legado" — the kit's own name is the data, never a generic label.
// `t` is already scoped to the "inventoryKardex" namespace (the caller's own useTranslations).
export function channelText(line: Pick<KardexPurchaseLine, "channel" | "soldAs">, t: T): string {
  if (line.channel === "kit" && line.soldAs) {
    return t("purchasesRefunds.channel.kitNamed", { kit: line.soldAs.name });
  }
  return channelLabel(line.channel, t);
}

export function channelLabel(channel: KardexPurchaseChannel, t: T): string {
  return t(`purchasesRefunds.channel.${channel}`);
}

// null when there is nothing undated to warn about.
export function undatedLegacyText(data: Pick<KardexPurchasesRefunds, "undatedLegacy">, t: T): string | null {
  const { packages, quantity } = data.undatedLegacy;
  if (packages <= 0) return null;
  return t("purchasesRefunds.undatedLegacy", { packages, quantity });
}
