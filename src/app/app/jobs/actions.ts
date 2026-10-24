"use server";

import { redirect } from "next/navigation";

import {
  JobSubmissionValidationError,
  parseJobSubmissionPayload,
} from "@/domain/job-submission";
import { requireCustomer } from "@/server/jobs/authorization";
import { JobOperationError } from "@/server/jobs/errors";
import { createCustomerJob } from "@/server/jobs/job-submission";

export interface JobSubmissionActionState {
  message: string;
  status: "error" | "idle";
}

export const initialJobSubmissionActionState: JobSubmissionActionState = {
  message: "",
  status: "idle",
};

function errorMessage(error: unknown) {
  if (error instanceof JobSubmissionValidationError) {
    return "Review the job details and try again.";
  }
  if (error instanceof JobOperationError) {
    const messages: Record<JobOperationError["code"], string> = {
      ATTACHMENT_INVALID:
        "One or more files do not meet the allowed type or size rules.",
      ATTACHMENT_UNAVAILABLE:
        "A file upload is unavailable or expired. Remove it and upload the file again.",
      ATTACHMENT_USED:
        "A file was already attached to another request. Upload it again for this job.",
      BUSINESS_UNAVAILABLE:
        "Job submission is temporarily unavailable for this account.",
      DUPLICATE_SUBMISSION:
        "The request could not be safely completed. Refresh your jobs before trying again.",
      SERVICE_UNAVAILABLE:
        "That service is no longer available for online submission. Choose another service.",
      SHOP_CLOSED:
        "We're not taking new jobs right now. Your existing jobs are still available.",
      SUBMISSION_INVALID:
        "Review the highlighted job details and submit again.",
    };
    return messages[error.code];
  }
  return "The job could not be submitted safely. Your request was not created.";
}

export async function submitCustomerJobAction(
  _state: JobSubmissionActionState,
  formData: FormData,
): Promise<JobSubmissionActionState> {
  let publicReference: string;
  try {
    const actor = await requireCustomer();
    const rawPayload = formData.get("submission");
    if (typeof rawPayload !== "string") {
      return { message: "The submission details are missing.", status: "error" };
    }
    const payload = parseJobSubmissionPayload(rawPayload);
    const job = await createCustomerJob(actor, payload);
    publicReference = job.publicReference;
  } catch (error) {
    return { message: errorMessage(error), status: "error" };
  }

  redirect(`/app/jobs/${encodeURIComponent(publicReference)}?submitted=1`);
}
