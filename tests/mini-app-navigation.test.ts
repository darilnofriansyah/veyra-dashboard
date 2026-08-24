import assert from "node:assert/strict";
import test from "node:test";
import { miniAppDestination } from "../src/lib/mini-app-navigation.ts";

test("uses only a positive numeric pocket start parameter for navigation", () => {
  assert.equal(miniAppDestination("pocket_42"), "/pockets/42");
  for (const value of [null, "", "pocket_0", "pocket_-1", "pocket_42/rename", "dashboard", "pocket_01"]) {
    assert.equal(miniAppDestination(value), "/dashboard");
  }
});
