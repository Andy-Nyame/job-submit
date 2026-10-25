export const WEBSITE_SERVICE_SLUG = "website-design-creation";
export const MAX_WEBSITE_ENQUIRY_MESSAGE_LENGTH = 2_000;
export const WEBSITE_ENQUIRY_RATE_LIMIT = 10;
export const WEBSITE_ENQUIRY_RATE_WINDOW_MS = 60_000;

export class WebsiteEnquiryValidationError extends Error {
  constructor(public readonly code: "EMPTY" | "MESSAGE_KEY" | "TEXT") {
    super(code);
    this.name = "WebsiteEnquiryValidationError";
  }
}

export function normalizeWebsiteEnquiryMessage(value: string) {
  const normalized = value.normalize("NFKC").trim();
  const unsafe = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === "<" || character === ">" || codePoint === 127 || (codePoint < 32 && character !== "\n" && character !== "\r" && character !== "\t");
  });
  if (!normalized) throw new WebsiteEnquiryValidationError("EMPTY");
  if (normalized.length > MAX_WEBSITE_ENQUIRY_MESSAGE_LENGTH || unsafe) {
    throw new WebsiteEnquiryValidationError("TEXT");
  }
  return normalized;
}
