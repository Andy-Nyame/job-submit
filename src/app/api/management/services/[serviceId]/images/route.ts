import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isUuid } from "@/domain/job-attachments";
import { isSameOriginMutation } from "@/server/http/same-origin";
import { requireServiceManager } from "@/server/services/authorization";
import { updateServiceGallery } from "@/server/services/images";

export async function PATCH(request: Request, context: { params: Promise<{ serviceId: string }> }) {
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "That request could not be verified." }, { status: 403 });
    const [{ serviceId }, body]: [{ serviceId: string }, unknown] = await Promise.all([context.params, request.json()]);
    if (!isUuid(serviceId) || typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Check the gallery changes and try again." }, { status: 400 });
    }
    const operation = Reflect.get(body, "operation");
    const actor = await requireServiceManager();
    if (operation === "REORDER") {
      const imageIds = Reflect.get(body, "imageIds");
      if (!Array.isArray(imageIds) || imageIds.some((id) => typeof id !== "string" || !isUuid(id))) throw new Error("Invalid order.");
      await updateServiceGallery(actor, { imageIds, operation, serviceId });
    } else {
      const imageId = Reflect.get(body, "imageId");
      if ((operation !== "COVER" && operation !== "REMOVE") || typeof imageId !== "string" || !isUuid(imageId)) throw new Error("Invalid action.");
      await updateServiceGallery(actor, { imageId, operation, serviceId });
    }
    revalidatePath("/");
    revalidatePath("/app/jobs/new");
    revalidatePath(`/app/services/${serviceId}`);
    return NextResponse.json({ message: "Service images updated." });
  } catch {
    return NextResponse.json({ error: "The service images could not be updated. Refresh and try again." }, { status: 400 });
  }
}
