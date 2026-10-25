import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_WEBSITE_ENQUIRY_MESSAGE_LENGTH,
  WebsiteEnquiryValidationError,
  normalizeWebsiteEnquiryMessage,
} from "./website-enquiries";

test("website enquiry messages preserve readable lines while normalizing surrounding space", () => {
  assert.equal(normalizeWebsiteEnquiryMessage("  I need an online shop.\nPlease include a catalogue.  "), "I need an online shop.\nPlease include a catalogue.");
});

test("website enquiry messages reject empty, markup, controls, and excessive text", () => {
  for (const value of ["", "<b>hello</b>", "hello\u0000", "a".repeat(MAX_WEBSITE_ENQUIRY_MESSAGE_LENGTH + 1)]) {
    assert.throws(() => normalizeWebsiteEnquiryMessage(value), WebsiteEnquiryValidationError);
  }
});
