import "server-only";

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host)
      .split(",", 1)[0]
      .trim();
    const protocol = (request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.slice(0, -1))
      .split(",", 1)[0]
      .trim();
    return originUrl.host === host && originUrl.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
