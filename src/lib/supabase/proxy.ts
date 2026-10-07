import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { safeInternalRedirect } from "@/domain/auth-policy";

import { getSupabasePublicConfig } from "./config";

const PROTECTED_PATH_PREFIXES = ["/app"];

function copySessionResponse(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  for (const header of ["cache-control", "expires", "pragma"] as const) {
    const value = source.headers.get(header);
    if (value) {
      target.headers.set(header, value);
    }
  }

  return target;
}

export async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { anonKey, url } = getSupabasePublicConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }

        for (const [name, value] of Object.entries(responseHeaders)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isProtectedPath = PROTECTED_PATH_PREFIXES.some(
    (prefix) =>
      request.nextUrl.pathname === prefix ||
      request.nextUrl.pathname.startsWith(`${prefix}/`),
  );

  if (isProtectedPath && !data?.claims?.sub) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      safeInternalRedirect(
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      ),
    );

    return copySessionResponse(response, NextResponse.redirect(loginUrl));
  }

  return response;
}
