import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isUuid } from "@/domain/job-attachments";
import { requireBusinessMembership } from "@/server/auth/authorization";
import { isSameOriginMutation } from "@/server/http/same-origin";
import { sendWebsiteEnquiryMessage, WebsiteEnquiryOperationError } from "@/server/jobs/website-enquiries";

export async function POST(request: Request, context: { params: Promise<{ publicReference: string }> }) {
  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "That request could not be verified." }, { status: 403 });
    const [{ publicReference }, body]: [{ publicReference: string }, unknown] = await Promise.all([context.params, request.json()]);
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new WebsiteEnquiryOperationError("VALIDATION");
    const message = Reflect.get(body, "message");
    const clientMessageKey = Reflect.get(body, "clientMessageKey");
    if (typeof message !== "string" || typeof clientMessageKey !== "string" || !isUuid(clientMessageKey)) throw new WebsiteEnquiryOperationError("VALIDATION");
    const actor = await requireBusinessMembership();
    const result = await sendWebsiteEnquiryMessage(actor, { body: message, clientMessageKey, publicReference });
    revalidatePath(`/app/jobs/${publicReference}`);
    revalidatePath(`/app/staff/jobs/${publicReference}`);
    return NextResponse.json({ id: result.id, message: "Message sent." });
  } catch (error) {
    if (error instanceof WebsiteEnquiryOperationError) {
      if (error.code === "NOT_FOUND") return NextResponse.json({ error: "This website enquiry was not found." }, { status: 404 });
      if (error.code === "RATE_LIMITED") return NextResponse.json({ error: "Please wait a moment before sending more messages." }, { status: 429 });
      return NextResponse.json({ error: "Write a message between 1 and 2,000 characters without markup." }, { status: 400 });
    }
    return NextResponse.json({ error: "Your message could not be sent. It is still in the box so you can try again." }, { status: 500 });
  }
}
