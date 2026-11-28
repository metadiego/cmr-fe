import { test } from "node:test";
import assert from "node:assert/strict";

import { channelLabel, channelText, undatedLegacyText } from "./purchases-refunds.ts";

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${JSON.stringify(values)})` : key;

test("channelText: direct and legacy use the plain label", () => {
  assert.equal(channelText({ channel: "direct", soldAs: null }, t), "purchasesRefunds.channel.direct");
  assert.equal(channelText({ channel: "legacy", soldAs: null }, t), "purchasesRefunds.channel.legacy");
});

test("channelText: kit names the kit actually sold, not a generic label", () => {
  assert.equal(
    channelText({ channel: "kit", soldAs: { sku: "K1", name: "Kit Nano Aer" } }, t),
    'purchasesRefunds.channel.kitNamed({"kit":"Kit Nano Aer"})',
  );
});

test("channelText: kit with no soldAs falls back to the plain label", () => {
  assert.equal(channelText({ channel: "kit", soldAs: null }, t), "purchasesRefunds.channel.kit");
});

test("channelLabel: one key per channel", () => {
  assert.equal(channelLabel("direct", t), "purchasesRefunds.channel.direct");
  assert.equal(channelLabel("kit", t), "purchasesRefunds.channel.kit");
  assert.equal(channelLabel("legacy", t), "purchasesRefunds.channel.legacy");
});

test("undatedLegacyText: null when there is nothing undated", () => {
  assert.equal(undatedLegacyText({ undatedLegacy: { packages: 0, quantity: 0 } }, t), null);
});

test("undatedLegacyText: the warning when there is", () => {
  assert.equal(
    undatedLegacyText({ undatedLegacy: { packages: 3, quantity: 12 } }, t),
    'purchasesRefunds.undatedLegacy({"packages":3,"quantity":12})',
  );
});
