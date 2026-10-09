import { test } from "node:test";
import assert from "node:assert/strict";

import { appThemeFromPreferences } from "./app-theme.ts";

test("dark only when the profile explicitly chose it", () => {
  assert.equal(appThemeFromPreferences({ tema: "oscuro" }), "dark");
  assert.equal(appThemeFromPreferences({ theme: "dark" }), "dark");
});

test("everything else is light: default, unknown values, missing prefs", () => {
  assert.equal(appThemeFromPreferences({ tema: "claro" }), "light");
  assert.equal(appThemeFromPreferences({ theme: "light" }), "light");
  assert.equal(appThemeFromPreferences({ tema: "sistema" }), "light");
  assert.equal(appThemeFromPreferences({}), "light");
  assert.equal(appThemeFromPreferences(null), "light");
  assert.equal(appThemeFromPreferences(undefined), "light");
});
