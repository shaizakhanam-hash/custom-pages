// ════════════════════════════════════════════════════════════════════════
// supabase/functions/whatsapp-send/index.ts
//
// Deploy with:
//   supabase functions deploy whatsapp-send
//   supabase secrets set WHATSAPP_PHONE_NUMBER_ID=xxxxxxxxxx WHATSAPP_ACCESS_TOKEN=xxxxxxxxxx
//
// IMPORTANT — WhatsApp policy: business-initiated messages sent outside an
// active 24-hour customer conversation MUST use a pre-approved message
// template (not freeform text). This function expects a template_id that
// maps to a template you've already gotten approved in Meta Business
// Manager (WhatsApp Manager → Message Templates). Sending arbitrary
// freeform text here will be rejected by the Graph API once a candidate's
// 24-hour window has closed, and templates are also what keep this from
// being usable to blast unsolicited messages.
// ════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const GRAPH_VERSION = "v19.0";

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

// Map your frontend template_id values to the exact template name + language
// registered in WhatsApp Manager. Update these once your templates are approved.
const TEMPLATE_MAP: Record<string, { name: string; lang: string }> = {
    application_received: { name: "application_received", lang: "en" },
    interview_invite: { name: "interview_invite", lang: "en" },
    document_request: { name: "document_request", lang: "en" },
};

function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    // Assumes India (+91) if no country code present — adjust for your market.
  return digits.length === 10 ? `91${digits}` : digits;
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

      const tpl = TEMPLATE_MAP[template_id];
              if (!tpl) {
                      return new Response(JSON.stringify({ error: `Unknown template_id: ${template_id}` }), {
                                status: 400,
                                headers: { ...corsHeaders, "Content-Type": "application/json" },
                      });
              }

      // Template body variables — order must match {{1}}, {{2}}... in the
      // approved template text (e.g. "Hi {{1}}, thanks for applying to {{2}}...").
      const bodyParams = [params?.name, params?.job_title].filter(Boolean).map((text) => ({ type: "text", text }));

      const payload = {
              messaging_product: "whatsapp",
              to: normalizePhone(phone),
              type: "template",
              template: {
                        name: tpl.name,
                        language: { code: tpl.lang },
                        components: bodyParams.length ? [{ type: "body", parameters: bodyParams }] : [],
              },
      };

      const resp = await fetch(
              `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
        {
                  method: "POST",
                  headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${ACCESS_TOKEN}`,
                  },
                  body: JSON.stringify(payload),
        }
            );

      const result = await resp.json();

      if (!resp.ok) {
              console.error("WhatsApp send error:", result);
              return new Response(JSON.stringify({ error: result }), {
                        status: 502,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
      }

      // Optional: update the applications row's whatsapp_last_sent_at /
      // whatsapp_last_template here via the Supabase service-role client,
      // so the admin table reflects real send history instead of just the
      // frontend's local state.

      return new Response(JSON.stringify({ success: true, meta: result }), {
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
