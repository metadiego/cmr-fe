// Which payment methods a cashier can pick (BE #564): active ones that CARRY MONEY. «Exonerada» does not
// (carriesMoney:false) — an exonerated consultation is a 100% discount, not a payment; the BE refuses it
// (400 PAYMENT_METHOD_CARRIES_NO_MONEY) and the cash count never adds it. The full list stays for labels
// of past payments.
type Method = { active?: boolean | null; carriesMoney?: boolean | null };

export function pickableMethods<T extends Method>(list: readonly T[]): T[] {
  return list.filter((m) => m.active !== false && m.carriesMoney !== false);
}
