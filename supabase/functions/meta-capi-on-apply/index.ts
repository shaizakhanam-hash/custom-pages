// ════════════════════════════════════════════════════════════════════════
// supabase/functions/meta-capi-on-apply/index.ts
//
// Deploy with:
//   supabase functions deploy meta-capi-on-apply
//   supabase secrets set META_PIXEL_ID=xxxxxxxxxx META_ACCESS_TOKEN=xxxxxxxxxx
//
// Trigger this either:
//   (a) directly from the frontend's sendServerConversion() call, or
//   (b) via a Supabase Database Webhook on INSERT to `applications`
//       (recommended — works even if the client tab closes early)
//
// Either way, this is the leg that actually matters for ad match quality:
// it sends hashed PII + the event_id shared with the browser Pixel so
// Meta dedupes the two signals into one high-confidence "Lead" event.
// Those Lead events are the audience Meta Ads Manager uses to build a
// Lookalike Audience — that's the mechanism behind "similar candidates
// get reached via Meta" (see setup-guide.md for the Ads Manager steps;
// there is no separate candidate-matching code to write here).
// ════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID")!;
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN")!;
const GRAPH_VERSION = "v19.0";

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await req.json();
    // Supports both direct-call payloads and Supabase Webhook payloads
    // (webhook wraps the row under `record`)
    const record = body.record ?? body;

    const {
      event_id,
      email,
      phone,
      job_id,
      job_title,
      utm_source,
      utm_campaign,
      fbclid,
    } = record;

    if (!email && !phone) {
      return new Response(JSON.stringify({ error: "email or phone required" }), { status: 400 });
    }

    const userData: Record<string, unknown> = {};
    if (email) userData.em = [await sha256(email)];
    if (phone) userData.ph = [await sha256(phone.replace(/\D/g, ""))];
    if (fbclid) userData.fbc = `fb.1.${Date.now()}.${fbclid}`;

    const eventPayload = {
      data: [
        {
          event_name: "Lead",
          event_time: Math.floor(Date.now() / 1000),
          event_id: event_id, // must match the eventID passed to fbq() client-side for dedup
          action_source: "website",
          user_data: userData,
          custom_data: {
            content_name: job_title,
            content_ids: [job_id],
            currency: "INR",
            value: 0,
            utm_source,
            utm_campaign,
          },
        },
      ],
    };

    const resp = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      }
    );

    const result = await resp.json();

    if (!resp.ok) {
      console.error("Meta CAPI error:", result);
      return new Response(JSON.stringify({ error: result }), { status: 502 });
    }

    return new Response(JSON.stringify({ success: true, meta: result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
