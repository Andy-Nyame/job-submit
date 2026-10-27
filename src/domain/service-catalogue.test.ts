import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SERVICE_BLUEPRINTS } from "./service-blueprints";
import {
  filterCatalogueServices,
  serviceCataloguePriceLabel,
} from "./service-catalogue";

function service(
  name: string,
  description: string | null,
  profile: keyof typeof SERVICE_BLUEPRINTS,
) {
  const blueprint = SERVICE_BLUEPRINTS[profile];
  return {
    description,
    name,
    pricingConfiguration: blueprint.pricing,
    quantityConfiguration: blueprint.quantity,
  };
}

test("catalogue search matches names and descriptions without changing source order", () => {
  const services = [
    service("Banner Printing", "Wide-format advertising banners", "BANNER_PRINTING"),
    service("Website Design & Creation", "Online shops and business websites", "ON_REQUEST"),
    service("Label Printing", "Printed product labels", "LABEL_PRINTING"),
  ];
  assert.deepEqual(filterCatalogueServices(services, "  WEBSITE  "), [services[1]]);
  assert.deepEqual(filterCatalogueServices(services, "product"), [services[2]]);
  assert.deepEqual(filterCatalogueServices(services, ""), services);
  assert.deepEqual(filterCatalogueServices(services, "missing"), []);
});

test("compact catalogue labels reflect authoritative pricing profiles", () => {
  assert.equal(serviceCataloguePriceLabel(service("Sticker", null, "STICKER_PRINTING")), "GH₵3 / sq ft · total by size");
  assert.equal(serviceCataloguePriceLabel(service("Banner", null, "BANNER_PRINTING")), "GH₵4 / sq ft · total by size");
  assert.equal(serviceCataloguePriceLabel(service("Poster", null, "POSTER_PRINTING")), "From GH₵3 / piece · minimum 4");
  assert.equal(serviceCataloguePriceLabel(service("Label", null, "LABEL_PRINTING")), "Price based on size and quantity");
  assert.equal(serviceCataloguePriceLabel(service("Website", null, "ON_REQUEST")), "Price on Request");
});

test("customer catalogue keeps compact responsive cards, search, and accessible gallery behavior", async () => {
  const [catalogue, gallery, image, publicSection] = await Promise.all([
    readFile(new URL("../components/jobs/customer-service-catalogue.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/services/service-gallery-preview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/services/service-catalogue-image.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/home/public-services-section.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of [catalogue, publicSection]) {
    assert.match(source, /grid-cols-2/u);
    assert.match(source, /sm:grid-cols-3/u);
    assert.match(source, /lg:grid-cols-4/u);
    assert.match(source, /xl:grid-cols-5/u);
  }
  assert.match(catalogue, /placeholder="Search services\.\.\."/u);
  assert.match(catalogue, /No services match your search/u);
  assert.match(catalogue, /Select Service/u);
  assert.match(gallery, /event\.key === "Escape"/u);
  assert.match(gallery, /document\.body\.style\.overflow = "hidden"/u);
  assert.match(gallery, /previousFocus\?\.focus\(\)/u);
  assert.match(gallery, /aria-modal="true"/u);
  assert.match(image, /aspect-\[4\/5\]/u);
  assert.match(image, /loading="lazy"/u);
});
