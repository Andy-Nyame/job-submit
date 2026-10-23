export const MAX_JOB_ATTACHMENTS = 5;
export const MAX_JOB_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_JOB_ATTACHMENTS_TOTAL_BYTES = 50 * 1024 * 1024;
export const CUSTOMER_UPLOAD_LIFETIME_MS = 60 * 60 * 1_000;

const allowedFileTypes = new Map<string, readonly string[]>([
  [".ai", ["application/pdf", "application/postscript"]],
  [".doc", ["application/msword"]],
  [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
  [".jpeg", ["image/jpeg"]],
  [".jpg", ["image/jpeg"]],
  [".pdf", ["application/pdf"]],
  [".png", ["image/png"]],
  [".psd", ["image/vnd.adobe.photoshop"]],
  [".txt", ["text/plain"]],
  [".webp", ["image/webp"]],
  [".xls", ["application/vnd.ms-excel"]],
  [".xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]],
]);

export const ALLOWED_JOB_ATTACHMENT_TYPES = Array.from(
  new Set(Array.from(allowedFileTypes.values()).flat()),
);

export interface CustomerUploadReference {
  originalFilename: string;
  pathname: string;
  uploadId: string;
}

export class JobAttachmentValidationError extends Error {
  constructor(
    public readonly code:
      | "FILE_COUNT"
      | "FILE_NAME"
      | "FILE_PATH"
      | "FILE_SIZE"
      | "FILE_TYPE"
      | "FILE_TOTAL_SIZE"
      | "UPLOAD_ID",
  ) {
    super(code);
    this.name = "JobAttachmentValidationError";
  }
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );
}

function extensionFor(filename: string) {
  const index = filename.lastIndexOf(".");
  return index > 0 ? filename.slice(index).toLowerCase() : "";
}

export function normalizeOriginalFilename(value: string) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const unsafe = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      character === "/" ||
      character === "\\" ||
      character === "<" ||
      character === ">" ||
      codePoint < 32 ||
      codePoint === 127
    );
  });
  if (!normalized || normalized.length > 255 || unsafe) {
    throw new JobAttachmentValidationError("FILE_NAME");
  }
  return normalized;
}

export function safeUploadFilename(value: string) {
  const original = normalizeOriginalFilename(value);
  const extension = extensionFor(original);
  const base = original.slice(0, Math.max(0, original.length - extension.length));
  const safeBase = base
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
  return `${safeBase || "reference-file"}${extension}`;
}

export function validateAttachmentMetadata(input: {
  byteSize: number;
  mimeType: string;
  originalFilename: string;
}) {
  const originalFilename = normalizeOriginalFilename(input.originalFilename);
  const allowedMimeTypes = allowedFileTypes.get(extensionFor(originalFilename));
  if (!allowedMimeTypes?.includes(input.mimeType)) {
    throw new JobAttachmentValidationError("FILE_TYPE");
  }
  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize < 1 ||
    input.byteSize > MAX_JOB_ATTACHMENT_BYTES
  ) {
    throw new JobAttachmentValidationError("FILE_SIZE");
  }
  return { byteSize: input.byteSize, mimeType: input.mimeType, originalFilename };
}

export function validateAttachmentBatch(
  attachments: readonly {
    byteSize: number;
    mimeType: string;
    originalFilename: string;
  }[],
) {
  if (attachments.length > MAX_JOB_ATTACHMENTS) {
    throw new JobAttachmentValidationError("FILE_COUNT");
  }
  const validated = attachments.map(validateAttachmentMetadata);
  const total = validated.reduce((sum, attachment) => sum + attachment.byteSize, 0);
  if (total > MAX_JOB_ATTACHMENTS_TOTAL_BYTES) {
    throw new JobAttachmentValidationError("FILE_TOTAL_SIZE");
  }
  return validated;
}

export function customerUploadPath(uploadId: string, filename: string) {
  if (!isUuid(uploadId)) {
    throw new JobAttachmentValidationError("UPLOAD_ID");
  }
  return `jobsubmit/customer-staging/${uploadId}/${safeUploadFilename(filename)}`;
}

export function validateCustomerUploadPath(uploadId: string, pathname: string) {
  if (!isUuid(uploadId)) {
    throw new JobAttachmentValidationError("UPLOAD_ID");
  }
  const prefix = `jobsubmit/customer-staging/${uploadId}/`;
  if (
    !pathname.startsWith(prefix) ||
    pathname.length > 500 ||
    pathname.slice(prefix.length).includes("/") ||
    pathname.slice(prefix.length).length < 1
  ) {
    throw new JobAttachmentValidationError("FILE_PATH");
  }
  return pathname;
}
