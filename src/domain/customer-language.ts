export function customerJobStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACCEPTED: "Your job was accepted",
    AWAITING_CUSTOMER_APPROVAL: "We need your approval",
    CANCELLED: "This job was cancelled",
    DECLINED: "This job was declined",
    PICKED_UP: "Collected",
    PREPARING_FOR_PICKUP: "We're getting it ready for pickup",
    PROCESSING: "We're working on your job",
    QUEUED: "Your job is in the work queue",
    READY_FOR_PICKUP: "Ready for pickup",
    SUBMITTED: "We received your job",
    UNDER_REVIEW: "We're checking your job",
    WAITING_FOR_CUSTOMER: "We need information from you",
  };
  return labels[status] ?? "Status updated";
}
