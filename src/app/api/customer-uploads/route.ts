import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import {
  ALLOWED_JOB_ATTACHMENT_TYPES,
  CUSTOMER_UPLOAD_LIFETIME_MS,
  MAX_JOB_ATTACHMENT_BYTES,
  customerUploadPath,
  isUuid,
  normalizeOriginalFilename,
} from "@/domain/job-attachments";
import { requireCustomer } from "@/server/jobs/authorization";
import {
  recordCompletedCustomerUpload,
  reserveCustomerUpload,
} from "@/server/jobs/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseClientPayload(value: string | null) {
  if (!value || value.length > 600) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      Object.keys(parsed).some(
        (key) => key !== "originalFilename" && key !== "uploadId",
      )
    ) {
      return null;
    }
    const uploadId = Reflect.get(parsed, "uploadId");
    const originalFilename = Reflect.get(parsed, "originalFilename");
    if (typeof uploadId !== "string" || typeof originalFilename !== "string") {
      return null;
    }
    return { uploadId, originalFilename };
  } catch {
    return null;
  }
}

function parseTokenPayload(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const uploadId = Reflect.get(parsed, "uploadId");
    return typeof uploadId === "string" && isUuid(uploadId) ? uploadId : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const actor = await requireCustomer();
        const upload = parseClientPayload(clientPayload);
        if (!upload) {
          throw new Error("Invalid upload request.");
        }
        const originalFilename = normalizeOriginalFilename(
          upload.originalFilename,
        );
        if (pathname !== customerUploadPath(upload.uploadId, originalFilename)) {
          throw new Error("Invalid upload path.");
        }
        await reserveCustomerUpload(actor, {
          originalFilename,
          uploadId: upload.uploadId,
        });
        return {
          addRandomSuffix: true,
          allowedContentTypes: ALLOWED_JOB_ATTACHMENT_TYPES,
          allowOverwrite: false,
          maximumSizeInBytes: MAX_JOB_ATTACHMENT_BYTES,
          tokenPayload: JSON.stringify({ uploadId: upload.uploadId }),
          validUntil: Date.now() + CUSTOMER_UPLOAD_LIFETIME_MS,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const uploadId = parseTokenPayload(tokenPayload);
        if (!uploadId) {
          throw new Error("Invalid upload completion.");
        }
        const metadata = await head(blob.pathname);
        await recordCompletedCustomerUpload({
          byteSize: metadata.size,
          mimeType: metadata.contentType,
          pathname: metadata.pathname,
          uploadId,
        });
      },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "The private file upload could not be authorized." },
      { status: 400 },
    );
  }
}
