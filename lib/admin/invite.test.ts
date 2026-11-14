import { test } from "node:test";
import assert from "node:assert/strict";

import { ALL_CENTERS, normalizeName, planInvite, suggestStaff } from "./invite.ts";

const people = [
  { id: "1", name: "José", lastName: "Pérez Rivera" },
  { id: "2", name: "Ana", lastName: "Ruiz" },
  { id: "3", name: "Luis", lastName: "Soto" },
  { id: "4", name: "Luis", lastName: "Soto Díaz" },
];

test("normalizeName drops accents, case and extra spaces", () => {
  assert.equal(normalizeName("  José   PÉREZ "), "jose perez");
});

test("suggestStaff matches the full name ignoring accents and case", () => {
  assert.equal(suggestStaff(people, "jose", "perez rivera")?.id, "1");
});

test("suggestStaff matches first name plus first word of the last name", () => {
  assert.equal(suggestStaff(people, "José", "Pérez")?.id, "1");
});

test("suggestStaff suggests nobody when two people match", () => {
  assert.equal(suggestStaff(people, "Luis", "Soto"), null);
});

test("suggestStaff needs both name and last name", () => {
  assert.equal(suggestStaff(people, "Ana", ""), null);
  assert.equal(suggestStaff(people, "Ana", "Torres"), null);
});

test("planInvite with one center sends center and role with the invite", () => {
  assert.deepEqual(planInvite("c1", ["c1", "c2"], "billing"), {
    inviteCenterId: "c1",
    inviteRole: "billing",
    extraCenterIds: [],
  });
});

test("planInvite with no center and no role sends nothing extra", () => {
  assert.deepEqual(planInvite("", ["c1", "c2"], ""), {
    inviteCenterId: undefined,
    inviteRole: undefined,
    extraCenterIds: [],
  });
});

test("planInvite for all centers assigns the rest after and grants the role globally", () => {
  assert.deepEqual(planInvite(ALL_CENTERS, ["c1", "c2", "c3"], "frontdesk"), {
    inviteCenterId: "c1",
    extraCenterIds: ["c2", "c3"],
    globalRole: "frontdesk",
  });
});

test("planInvite for all centers without a role grants no role", () => {
  assert.equal(planInvite(ALL_CENTERS, ["c1", "c2"], "").globalRole, undefined);
});

test("planInvite for all centers puts the linked staff record's center first", () => {
  const plan = planInvite(ALL_CENTERS, ["c1", "c2", "c3"], "", "c2");
  assert.equal(plan.inviteCenterId, "c2");
  assert.deepEqual(plan.extraCenterIds, ["c1", "c3"]);
});
