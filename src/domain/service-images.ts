import { isUuid } from "./job-attachments";

export const MAX_SERVICE_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_SERVICE_IMAGES = 12;
export const SERVICE_IMAGE_UPLOAD_LIFETIME_MS = 60 * 60 * 1_000;
export const ALLOWED_SERVICE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const extensions = new Map<string, (typeof ALLOWED_SERVICE_IMAGE_TYPES)[number]>([
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

export class ServiceImageValidationError extends Error {
  constructor(
    public readonly code:
      | "ALT_TEXT"
      | "FILE_COUNT"
      | "FILE_NAME"
      | "FILE_SIZE"
      | "FILE_TYPE"
      | "IMAGE_ID"
      | "IMAGE_SIGNATURE"
      | "PATH",
  ) {
    super(code);
    this.name = "ServiceImageValidationError";
  }
}

function hasUnsafeText(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === "<" || character === ">" || codePoint < 32 || codePoint === 127;
  });
}

export function normalizeServiceImageAltText(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > 240 || hasUnsafeText(normalized)) {
    throw new ServiceImageValidationError("ALT_TEXT");
  }
  return normalized;
}

export function normalizeServiceImageFilename(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (
    !normalized ||
    normalized.length > 255 ||
    hasUnsafeText(normalized) ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new ServiceImageValidationError("FILE_NAME");
  }
  const extension = normalized.slice(normalized.lastIndexOf(".")).toLowerCase();
  if (!extensions.has(extension)) throw new ServiceImageValidationError("FILE_TYPE");
  return normalized;
}

export function serviceImageMimeForFilename(filename: string) {
  const normalized = normalizeServiceImageFilename(filename);
  const extension = normalized.slice(normalized.lastIndexOf(".")).toLowerCase();
  return extensions.get(extension)!;
}

export function serviceImagePath(imageId: string, filename: string) {
  if (!isUuid(imageId)) throw new ServiceImageValidationError("IMAGE_ID");
  const normalized = normalizeServiceImageFilename(filename);
  const extension = normalized.slice(normalized.lastIndexOf(".")).toLowerCase();
  return `jobsubmit/service-images/${imageId}/image${extension}`;
}

export function validateServiceImagePath(imageId: string, pathname: string) {
  if (
    !isUuid(imageId) ||
    pathname.length > 500 ||
    !pathname.startsWith(`jobsubmit/service-images/${imageId}/`) ||
    pathname.slice(`jobsubmit/service-images/${imageId}/`.length).includes("/")
  ) {
    throw new ServiceImageValidationError("PATH");
  }
}

export function validateServiceImageMetadata(input: {
  byteSize: number;
  mimeType: string;
  originalFilename: string;
}) {
  const filename = normalizeServiceImageFilename(input.originalFilename);
  if (serviceImageMimeForFilename(filename) !== input.mimeType) {
    throw new ServiceImageValidationError("FILE_TYPE");
  }
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > MAX_SERVICE_IMAGE_BYTES) {
    throw new ServiceImageValidationError("FILE_SIZE");
  }
  return filename;
}

export function validateServiceImageSignature(bytes: Uint8Array, mimeType: string) {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png =
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (
    (mimeType === "image/jpeg" && !jpeg) ||
    (mimeType === "image/png" && !png) ||
    (mimeType === "image/webp" && !webp) ||
    !ALLOWED_SERVICE_IMAGE_TYPES.includes(mimeType as (typeof ALLOWED_SERVICE_IMAGE_TYPES)[number])
  ) {
    throw new ServiceImageValidationError("IMAGE_SIGNATURE");
  }
}
