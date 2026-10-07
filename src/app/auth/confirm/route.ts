import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getApplicationPrincipal } from "@/server/auth/authorization";
import { createServerSupabaseClient } from "@/server/auth/supabase";

export const dynamic = "force-dynamic";

const SUPPORTED_CONFIRMATION_TYPES = new Set<EmailOtpType>(["email", "signup"]);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const responseHeaders = new Headers();
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const requestedType = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const errorPage = new URL("/auth/error?reason=confirmation", requestUrl.origin);

  if (
    !tokenHash ||
    !requestedType ||
    !SUPPORTED_CONFIRMATION_TYPES.has(requestedType)
  ) {
    return NextResponse.redirect(errorPage, { headers: responseHeaders });
  }

  const supabase = await createServerSupabaseClient({
    outgoingHeaders: responseHeaders,
    requireCookieWrites: true,
  });
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: requestedType,
  });

  if (error) {
    return NextResponse.redirect(errorPage, { headers: responseHeaders });
  }

  try {
    const principal = await getApplicationPrincipal(supabase);
    if (!principal) {
      throw new Error("Confirmed identity could not be resolved.");
    }

    return NextResponse.redirect(
      new URL(principal.access.allowed ? "/app" : "/access-denied", requestUrl),
      { headers: responseHeaders },
    );
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(
      new URL("/auth/error?reason=account", requestUrl),
      { headers: responseHeaders },
    );
  }
}
