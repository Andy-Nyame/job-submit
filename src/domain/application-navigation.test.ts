import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getActiveApplicationNavigationHref,
  getApplicationNavigation,
} from "./application-navigation";

function hrefs(role: Parameters<typeof getApplicationNavigation>[0]) {
  return getApplicationNavigation(role).map((item) => item.href);
}

test("application navigation exposes only role-appropriate implemented routes", () => {
  assert.deepEqual(hrefs("CUSTOMER"), [
    "/app",
    "/app/jobs/new",
    "/app/jobs",
  ]);
  assert.deepEqual(hrefs("WORKER"), [
    "/app",
    "/app/staff/jobs",
    "/app/profile",
  ]);
  assert.deepEqual(hrefs("ADMIN"), [
    "/app",
    "/app/staff/jobs",
    "/app/services",
    "/app/team",
  ]);
  assert.deepEqual(hrefs("OWNER"), hrefs("ADMIN"));
});

test("active navigation chooses the most specific matching route", () => {
  const customerItems = getApplicationNavigation("CUSTOMER");
  const staffItems = getApplicationNavigation("WORKER");

  assert.equal(
    getActiveApplicationNavigationHref("/app/jobs/new", customerItems),
    "/app/jobs/new",
  );
  assert.equal(
    getActiveApplicationNavigationHref("/app/jobs/JOB-123", customerItems),
    "/app/jobs",
  );
  assert.equal(
    getActiveApplicationNavigationHref(
      "/app/staff/jobs/JOB-123",
      staffItems,
    ),
    "/app/staff/jobs",
  );
  assert.equal(
    getActiveApplicationNavigationHref("/app/profile", customerItems),
    null,
  );
});

test("mobile drawer implements accessible closing, focus, and scroll-lock behavior", () => {
  const source = readFileSync(
    new URL("../components/layout/app-navigation.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /aria-expanded=\{open\}/u);
  assert.match(source, /aria-modal="true"/u);
  assert.match(source, /role="dialog"/u);
  assert.match(source, /event\.key === "Escape"/u);
  assert.match(source, /event\.key !== "Tab"/u);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/u);
  assert.match(source, /matchMedia\("\(min-width: 1024px\)"\)/u);
  assert.match(source, /triggerRef\.current\?\.focus\(\)/u);
  assert.match(source, /onNavigate=\{\(\) => closeDrawer\(false\)\}/u);
  assert.match(source, /aria-current=\{active \? "page" : undefined\}/u);
  assert.match(source, /hidden h-dvh[\s\S]*lg:flex/u);
  assert.match(source, /lg:hidden/u);
});

test("shared text-entry controls remain at least 16px below desktop widths", () => {
  const controls = readFileSync(
    new URL("../components/ui/form-controls.tsx", import.meta.url),
    "utf8",
  );
  const layout = readFileSync(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(controls, /text-base/u);
  assert.match(controls, /lg:text-sm/u);
  assert.doesNotMatch(controls, /sm:text-sm|md:text-sm/u);
  assert.doesNotMatch(layout, /userScalable|user-scalable|maximumScale|maximum-scale/u);
});
