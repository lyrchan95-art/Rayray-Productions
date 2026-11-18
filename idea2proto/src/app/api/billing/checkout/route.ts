import { NextResponse } from "next/server";
import { requireApiUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";

/**
 * Stripe Checkout for Pro. Card + Alipay (AlipayHK wallets) via Stripe; Stripe has no FPS rail,
 * so FPS is offered as a manual transfer flow (see README) until a local PSP is integrated.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireApiUser();
  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRO_PRICE_ID;
  if (!key || !price) throw new HttpError(503, "Billing is not configured yet", "billing");
  const origin = new URL(req.url).origin;
  const form = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "payment_method_types[0]": "card",
    "payment_method_types[1]": "alipay",
    client_reference_id: u.id,
    customer_email: u.email,
    success_url: `${origin}/settings?upgraded=1`,
    cancel_url: `${origin}/settings`,
    locale: u.register === "en" ? "en" : "zh-HK",
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const json = (await res.json()) as { url?: string; error?: { message: string } };
  if (!res.ok || !json.url) throw new HttpError(502, json.error?.message ?? "Stripe error");
  return NextResponse.json({ url: json.url });
});
