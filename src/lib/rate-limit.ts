import "server-only";

import { createHash } from "node:crypto";

const IP_HEADERS = [
  "cf-connecting-ip",
  "fly-client-ip",
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-forwarded-for",
];

function getRateLimitSalt() {
  return (
    process.env.RATE_LIMIT_SALT?.trim() ??
    process.env.ADMIN_SESSION_SECRET?.trim() ??
    process.env.ADMIN_PASSWORD?.trim() ??
    process.env.SUPABASE_URL?.trim() ??
    "field-notes-guestbook"
  );
}

function getClientIp(request: Request) {
  for (const header of IP_HEADERS) {
    const value = request.headers.get(header)?.trim();

    if (!value) {
      continue;
    }

    if (header === "x-forwarded-for" || header === "x-vercel-forwarded-for") {
      const [firstIp] = value.split(",");

      if (firstIp?.trim()) {
        return firstIp.trim();
      }
    } else {
      return value;
    }
  }

  return "unknown";
}

export function createSourceKey(request: Request) {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent")?.trim() ?? "unknown";
  const hash = createHash("sha256");

  hash.update(getRateLimitSalt());
  hash.update("|");
  hash.update(clientIp);
  hash.update("|");
  hash.update(userAgent.slice(0, 160));

  return hash.digest("hex");
}
