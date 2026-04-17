import { createHash, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEquals(a: string, b: string) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function GET(req: NextRequest) {
  const debugKey = process.env.DEBUG_FINGERPRINT_KEY;
  const headerKey = req.headers.get("x-debug-key");

  if (!debugKey) {
    return new Response("Not Found", { status: 404 });
  }
  if (!headerKey || !constantTimeEquals(headerKey, debugKey)) {
    return new Response("Not Found", { status: 404 });
  }

  const secret = process.env.AUTH_SECRET ?? "";
  const sha256 = createHash("sha256").update(secret, "utf8").digest("hex");

  return Response.json(
    { configured: Boolean(secret), length: secret.length, sha256 },
    { headers: { "cache-control": "no-store" } },
  );
}

