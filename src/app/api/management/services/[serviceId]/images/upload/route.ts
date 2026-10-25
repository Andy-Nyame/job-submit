import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isUuid } from "@/domain/job-attachments";
import {
  ALLOWED_SERVICE_IMAGE_TYPES,
  MAX_SERVICE_IMAGE_BYTES,
  SERVICE_IMAGE_UPLOAD_LIFETIME_MS,
  normalizeServiceImageAltText,
  normalizeServiceImageFilename,
  serviceImagePath,
} from "@/domain/service-images";
import { requireServiceManager } from "@/server/services/authorization";
import {
  completeServiceImageUpload,
  reserveServiceImage,
} from "@/server/services/images";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface UploadPayload {
  altText: string;
  imageId: string;
  originalFilename: string;
  replacesImageId: string | null;
}

function parsePayload(value: string | null): UploadPayload | null {
  if (!value || value.length > 1_200) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const altText = Reflect.get(parsed, "altText");
    const imageId = Reflect.get(parsed, "imageId");
    const originalFilename = Reflect.get(parsed, "originalFilename");
    const replacesImageId = Reflect.get(parsed, "replacesImageId");
    if (
      typeof altText !== "string" ||
      typeof imageId !== "string" ||
      typeof originalFilename !== "string" ||
      (replacesImageId !== null && typeof replacesImageId !== "string") ||
      !isUuid(imageId) ||
      (typeof replacesImageId === "string" && !isUuid(replacesImageId))
    ) return null;
    return { altText, imageId, originalFilename, replacesImageId };
  } catch {
    return null;
  }
}

function parseToken(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const businessId = Reflect.get(parsed, "businessId");
    const imageId = Reflect.get(parsed, "imageId");
    const membershipId = Reflect.get(parsed, "membershipId");
    const serviceId = Reflect.get(parsed, "serviceId");
    const userId = Reflect.get(parsed, "userId");
    if (![businessId, imageId, membershipId, serviceId, userId].every((item) => typeof item === "string" && isUuid(item))) return null;
    return { businessId: businessId as string, imageId: imageId as string, membershipId: membershipId as string, serviceId: serviceId as string, userId: userId as string };
  } catch {
    return null;
  }
}

export async function POST(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  try {
    const { serviceId } = await context.params;
    if (!isUuid(serviceId)) throw new Error("Invalid service.");
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const actor = await requireServiceManager();
        const payload = parsePayload(clientPayload);
        if (!payload) throw new Error("Invalid upload request.");
        const originalFilename = normalizeServiceImageFilename(payload.originalFilename);
        const altText = normalizeServiceImageAltText(payload.altText);
        if (pathname !== serviceImagePath(payload.imageId, originalFilename)) throw new Error("Invalid upload path.");
        await reserveServiceImage(actor, { ...payload, altText, originalFilename, serviceId });
        return {
          addRandomSuffix: true,
          allowedContentTypes: [...ALLOWED_SERVICE_IMAGE_TYPES],
          allowOverwrite: false,
          maximumSizeInBytes: MAX_SERVICE_IMAGE_BYTES,
          tokenPayload: JSON.stringify({ businessId: actor.businessId, imageId: payload.imageId, membershipId: actor.membershipId, serviceId, userId: actor.userId }),
          validUntil: Date.now() + SERVICE_IMAGE_UPLOAD_LIFETIME_MS,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const token = parseToken(tokenPayload);
        if (!token) throw new Error("Invalid upload completion.");
        const metadata = await head(blob.pathname);
        await completeServiceImageUpload({ ...token, pathname: metadata.pathname });
        revalidatePath("/");
        revalidatePath("/app/jobs/new");
        revalidatePath(`/app/services/${token.serviceId}`);
      },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "The service image could not be uploaded. Check the file and try again." }, { status: 400 });
  }
}
