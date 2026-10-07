import { NextResponse } from "next/server";

import { safeInternalRedirect } from "@/domain/auth-policy";
import { getApplicationPrincipal } from "@/server/auth/authorization";
import { createServerSupabaseClient } from "@/server/auth/supabase";

export const dynamic = "force-dynamic";

function redirectResponse(url: URL, headers: Headers) {
  return NextResponse.redirect(url, { headers });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const responseHeaders = new Headers();
  const errorPage = new URL("/auth/error", requestUrl.origin);

  if (requestUrl.searchParams.has("error")) {
    errorPage.searchParams.set("reason", "provider");
    return redirectResponse(errorPage, responseHeaders);
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    errorPage.searchParams.set("reason", "callback");
    return redirectResponse(errorPage, responseHeaders);
  }

  const supabase = await createServerSupabaseClient({
    outgoingHeaders: responseHeaders,
    requireCookieWrites: true,
  });
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (error) {
    errorPage.searchParams.set("reason", "callback");
    return redirectResponse(errorPage, responseHeaders);
  }

  try {
    const principal = await getApplicationPrincipal(supabase);
    if (!principal) {
      throw new Error("Authenticated callback did not resolve an identity.");
    }

    const destination = principal.access.allowed
      ? safeInternalRedirect(requestUrl.searchParams.get("next"))
      : "/access-denied";
    return redirectResponse(
      new URL(destination, requestUrl.origin),
      responseHeaders,
    );
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    errorPage.searchParams.set("reason", "account");
    return redirectResponse(errorPage, responseHeaders);
  }
}
