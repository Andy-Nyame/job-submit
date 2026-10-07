import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

interface ServerSupabaseClientOptions {
  outgoingHeaders?: Headers;
  requireCookieWrites?: boolean;
}

export async function createServerSupabaseClient(
  options: ServerSupabaseClientOptions = {},
) {
  const cookieStore = await cookies();
  const { anonKey, url } = getSupabasePublicConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch (error) {
          if (options.requireCookieWrites) {
            throw error;
          }

          // Server Components cannot write response cookies. The request-wide
          // proxy refreshes sessions before rendering in that environment.
        }

        if (options.outgoingHeaders) {
          for (const [name, value] of Object.entries(responseHeaders)) {
            options.outgoingHeaders.set(name, value);
          }
        }
      },
    },
  });
}
