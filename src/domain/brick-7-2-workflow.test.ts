import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("service galleries are business-scoped, manager-only, private, and audit lifecycle changes", async () => {
  const [schema, server, uploadRoute, imageRoute] = await Promise.all([
    read("../../prisma/schema.prisma"),
    read("../server/services/images.ts"),
    read("../app/api/management/services/[serviceId]/images/upload/route.ts"),
    read("../app/api/service-images/[imageId]/route.ts"),
  ]);
  assert.match(schema, /model ServiceImage/u);
  assert.match(schema, /ServiceImage_one_cover_per_service_key|isCover/u);
  assert.match(server, /role !== "OWNER" && actor\.role !== "ADMIN"/u);
  assert.match(server, /businessId: actor\.businessId/u);
  assert.match(server, /service\.image_(?:added|replaced|removed|cover_selected)/u);
  assert.match(uploadRoute, /allowedContentTypes/u);
  assert.match(uploadRoute, /maximumSizeInBytes/u);
  assert.match(imageRoute, /access: "private"/u);
  assert.match(imageRoute, /X-Content-Type-Options/u);
});

test("website enquiry chat is canonical-job linked, retry-safe, role-limited, and notification backed", async () => {
  const [schema, enquiry, submission, route] = await Promise.all([
    read("../../prisma/schema.prisma"),
    read("../server/jobs/website-enquiries.ts"),
    read("../server/jobs/job-submission.ts"),
    read("../app/api/jobs/[publicReference]/enquiry-messages/route.ts"),
  ]);
  assert.match(schema, /clientMessageKey\s+String\?\s+@unique/u);
  assert.match(enquiry, /actor\.role === "OWNER" \|\| actor\.role === "ADMIN"/u);
  assert.match(enquiry, /service: \{ slug: WEBSITE_SERVICE_SLUG \}/u);
  assert.match(enquiry, /customer: \{ userId: actor\.userId \}/u);
  assert.match(enquiry, /WEBSITE_ENQUIRY_RATE_LIMIT/u);
  assert.match(enquiry, /notifyManagementOfWebsiteEnquiry/u);
  assert.match(enquiry, /notifyCustomerOfWebsiteEnquiryReply/u);
  assert.match(submission, /transaction\.jobMessage\.create/u);
  assert.match(route, /isSameOriginMutation/u);
});

test("standalone services stay offline in the migration and future Sticker orders no longer expose embedded poster or label choices", async () => {
  const [migration, blueprints] = await Promise.all([
    read("../../prisma/migrations/20261025120000_visual_catalogue_enquiries/migration.sql"),
    read("./service-blueprints.ts"),
  ]);
  assert.match(migration, /'Poster Printing'.*'poster-printing'/su);
  assert.match(migration, /'Label Printing'.*'label-printing'/su);
  assert.match(migration, /'Website Design & Creation'.*'website-design-creation'/su);
  assert.match(migration, /true, false, false, 30/su);
  assert.match(blueprints, /POSTER_PRINTING/u);
  assert.match(blueprints, /LABEL_PRINTING/u);
  const currentSticker = blueprints.slice(blueprints.indexOf("STICKER_PRINTING: {"));
  assert.match(currentSticker, /strategy\("STICKER_PRINTING", "AREA_BASED"\)/u);
  assert.doesNotMatch(currentSticker.split("};\n\nexport function")[0] ?? "", /Poster printing|Labels/u);
});
