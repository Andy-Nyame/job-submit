import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { RedeemInvitationPanel } from "@/components/team/redeem-invitation-panel";
import { getApplicationPrincipal } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accept worker invitation",
  referrer: "no-referrer",
  robots: { follow: false, index: false },
};

export default async function RedeemWorkerInvitationPage() {
  const principal = await getApplicationPrincipal();
  if (principal && !principal.access.allowed) {
    redirect("/access-denied");
  }

  return (
    <AuthShell
      description="Worker access is granted only after an authenticated, verified email matches a live invitation."
      heading="Accept worker invitation"
    >
      <RedeemInvitationPanel authenticated={Boolean(principal)} />
    </AuthShell>
  );
}
