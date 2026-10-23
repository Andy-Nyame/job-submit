import assert from "node:assert/strict";
import test from "node:test";

import {
  JobAttachmentValidationError,
  MAX_JOB_ATTACHMENT_BYTES,
  customerUploadPath,
  normalizeOriginalFilename,
  safeUploadFilename,
  validateAttachmentBatch,
  validateAttachmentMetadata,
  validateCustomerUploadPath,
} from "./job-attachments";

const uploadId = "11111111-1111-4111-8111-111111111111";

test("customer upload paths are opaque, bounded, and tied to one reservation", () => {
  const pathname = customerUploadPath(uploadId, "My Artwork (final).PDF");
  assert.equal(
    pathname,
    `jobsubmit/customer-staging/${uploadId}/My-Artwork-final.pdf`,
  );
  assert.equal(validateCustomerUploadPath(uploadId, pathname), pathname);
  assert.throws(
    () => validateCustomerUploadPath(uploadId, pathname.replace(uploadId, "22222222-2222-4222-8222-222222222222")),
    JobAttachmentValidationError,
  );
});

test("original filenames are preserved safely while storage names are normalized", () => {
  assert.equal(normalizeOriginalFilename("  Label 01.pdf "), "Label 01.pdf");
  assert.equal(safeUploadFilename("Café artwork 01.png"), "Cafe-artwork-01.png");
  assert.throws(() => normalizeOriginalFilename("../secret.pdf"));
  assert.throws(() => normalizeOriginalFilename("unsafe<script>.pdf"));
});

test("supported design, image, and document types validate by extension and MIME", () => {
  assert.deepEqual(
    validateAttachmentMetadata({
      byteSize: 1_024,
      mimeType: "application/pdf",
      originalFilename: "artwork.ai",
    }),
    {
      byteSize: 1_024,
      mimeType: "application/pdf",
      originalFilename: "artwork.ai",
    },
  );
  assert.doesNotThrow(() =>
    validateAttachmentMetadata({
      byteSize: 2_048,
      mimeType: "image/vnd.adobe.photoshop",
      originalFilename: "layout.psd",
    }),
  );
});

test("executables, MIME spoofing, empty files, and oversized files are rejected", () => {
  for (const input of [
    { byteSize: 10, mimeType: "application/x-msdownload", originalFilename: "run.exe" },
    { byteSize: 10, mimeType: "text/html", originalFilename: "image.png" },
    { byteSize: 0, mimeType: "image/png", originalFilename: "image.png" },
    { byteSize: MAX_JOB_ATTACHMENT_BYTES + 1, mimeType: "image/png", originalFilename: "image.png" },
  ]) {
    assert.throws(() => validateAttachmentMetadata(input), JobAttachmentValidationError);
  }
});

test("attachment batches enforce count and aggregate limits", () => {
  assert.doesNotThrow(() =>
    validateAttachmentBatch([
      { byteSize: 1_000, mimeType: "image/jpeg", originalFilename: "one.jpg" },
      { byteSize: 2_000, mimeType: "application/pdf", originalFilename: "two.pdf" },
    ]),
  );
  assert.throws(
    () =>
      validateAttachmentBatch(
        Array.from({ length: 6 }, (_, index) => ({
          byteSize: 1,
          mimeType: "image/png",
          originalFilename: `${index}.png`,
        })),
      ),
    JobAttachmentValidationError,
  );
});
