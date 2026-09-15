/** 优先使用部署时指定的公开地址，避免 standalone 内部地址导致合法请求被拒绝。 */
export function isSameOriginRequest(request: Request, publicUrl?: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const expected = new URL(publicUrl || request.url);
    if (!publicUrl) {
      const host = request.headers.get("host");
      if (host) expected.host = host;
    }
    return origin === expected.origin;
  } catch {
    return false;
  }
}
