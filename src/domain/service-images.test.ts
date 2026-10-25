import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SERVICE_IMAGE_BYTES,
  ServiceImageValidationError,
  normalizeServiceImageAltText,
  serviceImagePath,
  validateServiceImageMetadata,
  validateServiceImageSignature,
} from "./service-images";

const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("service image paths are opaque and limited to approved raster formats", () => {
  assert.equal(serviceImagePath(id, "Finished banner.JPG"), `jobsubmit/service-images/${id}/image.jpg`);
  assert.throws(() => serviceImagePath(id, "unsafe.svg"), ServiceImageValidationError);
  assert.throws(() => serviceImagePath(id, "../photo.png"), ServiceImageValidationError);
});

test("service image metadata enforces matching MIME and the 8 MB limit", () => {
  assert.equal(validateServiceImageMetadata({ byteSize: 1024, mimeType: "image/png", originalFilename: "sample.png" }), "sample.png");
  assert.throws(() => validateServiceImageMetadata({ byteSize: 1024, mimeType: "image/jpeg", originalFilename: "sample.png" }), ServiceImageValidationError);
  assert.throws(() => validateServiceImageMetadata({ byteSize: MAX_SERVICE_IMAGE_BYTES + 1, mimeType: "image/png", originalFilename: "sample.png" }), ServiceImageValidationError);
});

test("actual image signatures reject renamed scripts and SVG content", () => {
  assert.doesNotThrow(() => validateServiceImageSignature(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"));
  assert.doesNotThrow(() => validateServiceImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"));
  assert.doesNotThrow(() => validateServiceImageSignature(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"));
  assert.throws(() => validateServiceImageSignature(new TextEncoder().encode("<script>bad</script>"), "image/png"), ServiceImageValidationError);
});

test("image alternative text is meaningful, bounded, and markup-free", () => {
  assert.equal(normalizeServiceImageAltText("  Finished   label samples  "), "Finished label samples");
  assert.throws(() => normalizeServiceImageAltText(""), ServiceImageValidationError);
  assert.throws(() => normalizeServiceImageAltText("<img>"), ServiceImageValidationError);
});
