import { createHmac, timingSafeEqual } from "node:crypto";
import { run } from "@/lib/db";

/** Verifies the Stripe-Signature header (v1, HMAC-SHA256) without the SDK. */
function verify(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("not configured", { status: 503 });
  const payload = await req.text();
  if (!verify(payload, req.headers.get("stripe-signature"), secret)) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, string> } };
  const o = event.data.object;
  if (event.type === "checkout.session.completed" && o.client_reference_id) {
    run(`UPDATE users SET plan='pro', stripe_customer_id=? WHERE id=?`, o.customer ?? null, o.client_reference_id);
  }
  if (event.type === "customer.subscription.deleted" && o.customer) {
    run(`UPDATE users SET plan='free' WHERE stripe_customer_id=?`, o.customer);
  }
  return new Response("ok");
}
