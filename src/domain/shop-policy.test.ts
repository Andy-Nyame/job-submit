import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanManageShop,
  canManageShop,
  defaultApplicationRoute,
  shopAuditAction,
  ShopPolicyError,
} from "./shop-policy";

test("only OWNER and ADMIN can manage business intake", () => {
  assert.equal(canManageShop("OWNER"), true);
  assert.equal(canManageShop("ADMIN"), true);
  assert.equal(canManageShop("WORKER"), false);
  assert.equal(canManageShop("CUSTOMER"), false);
  assert.doesNotThrow(() => assertCanManageShop("OWNER"));
  assert.throws(
    () => assertCanManageShop("WORKER"),
    (error: unknown) => error instanceof ShopPolicyError,
  );
});

test("role defaults lead directly to useful authorized work", () => {
  assert.equal(defaultApplicationRoute("CUSTOMER"), "/app/jobs/new");
  assert.equal(defaultApplicationRoute("WORKER"), "/app/staff/jobs");
  assert.equal(defaultApplicationRoute("ADMIN"), "/app/staff/jobs");
  assert.equal(defaultApplicationRoute("OWNER"), "/app/staff/jobs");
});

test("shop lifecycle events use stable auditable action names", () => {
  assert.equal(shopAuditAction(true), "business.shop_opened");
  assert.equal(shopAuditAction(false), "business.shop_closed");
});
