// ════════════════════════════════════════════════════════════════════════
// supabase/functions/whatsapp-send/index.ts
//
// Deploy with:
//   supabase functions deploy whatsapp-send
//   supabase secrets set AISENSY_API_KEY=xxxxxxxxxx
//
// Sends WhatsApp notifications through AiSensy's API Campaign feature
// (https://backend.aisensy.com/campaign/t1/api/v2). Each entry in
// CAMPAIGN_MAP below maps a frontend template_id to the exact AiSensy
// campaign name (Campaigns -> API Campaign -> campaign must be "Live").
//
// "job_promotion" -> "Custom Page Jobs" campaign. Its approved WhatsApp
// template has 6 body variables plus a 7th dynamic value for the CTA
// button's URL (base URL configured in AiSensy as
// https://custom-pages-alpha.vercel.app/job/{{7}} — AiSensy appends the
// 7th templateParams value to that base URL). templateParams order must
// match the template exactly:
//   1. candidate name
//   2. job title
//   3. company
//   4. location
//   5. experience required
//   6. salary offered
//   7. job id (appended to the CTA button's base URL by AiSensy)
// ════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const AISENSY_API_KEY = Deno.env.get("AISENSY_API_KEY")!;
const AISENSY_ENDPOINT = "https://backend.aisensy.com/campaign/t1/api/v2";

// CORS: the frontend calls this function directly from the browser
// (custom-pages-alpha.vercel.app), which is a different origin than
// this function's supabase.co domain, so every response — including the
// OPTIONS preflight the browser sends first — must carry these headers
// or the browser blocks the request before your code's result is ever
// read client-side.
const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map your frontend template_id values to the exact AiSensy campaign name.
// Add the other three (application_received, interview_invite,
// document_request) here once those campaigns are live in AiSensy.
const CAMPAIGN_MAP: Record<string, string> = {
      job_promotion: "Custom Page Jobs",
};

function normalizePhone(phone: string): string {
      const digits = phone.replace(/\D/g, "");
      // AiSensy wants a country code. Assumes India (+91) if a bare 10-digit
  // number comes in — adjust for your market.
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
      return `+${withCountryCode}`;
}

serve(async (req) => {
      if (req.method === "OPTIONS") {
              return new Response("ok", { headers: corsHeaders });
      }

        try {
                if (req.method !== "POST") {
                          return new Response("Method not allowed", { status: 405, headers: corsHeaders });
                }

        const { phone, template_id, params } = await req.json();

        if (!phone || !template_id) {
                  return new Response(JSON.stringify({ error: "phone and template_id required" }), {
                              status: 400,
                              headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
        }

        const campaignName = CAMPAIGN_MAP[template_id];
                if (!campaignName) {
                          return new Response(JSON.stringify({ error: `Unknown template_id: ${template_id}` }), {
                                      status: 400,
                                      headers: { ...corsHeaders, "Content-Type": "application/json" },
                          });
                }

        // Order matters — must match the {{1}}..{{7}} variables in the
        // approved AiSensy template exactly. See the CAMPAIGN_MAP comment
        // above for the "job_promotion" / "Custom Page Jobs" order.
        const templateParams = [
                  params?.name ?? "",
                  params?.job_title ?? "",
                  params?.company ?? "",
                  params?.location ?? "",
                  params?.exp ?? "",
                  params?.salary ?? "",
                  params?.job_id ?? "",
                ];

        const payload = {
                  apiKey: AISENSY_API_KEY,
                  campaignName,
                  destination: normalizePhone(phone),
                  userName: params?.name ?? "Candidate",
                  templateParams,
        };

        const resp = await fetch(AISENSY_ENDPOINT, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
        });

        const result = await resp.json().catch(() => ({}));

        if (!resp.ok) {
                  console.error("AiSensy send error:", result);
                  return new Response(JSON.stringify({ error: result }), {
                              status: 502,
                              headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
        }

        return new Response(JSON.stringify({ success: true, aisensy: result }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
        } catch (err) {
                console.error(err);
                return new Response(JSON.stringify({ error: String(err) }), {
                          status: 500,
                          headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
        }
});
