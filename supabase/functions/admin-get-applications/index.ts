// ════════════════════════════════════════════════════════════════════════
// supabase/functions/admin-get-applications/index.ts
//
// Deploy with:
//   supabase functions deploy admin-get-applications
//   supabase secrets set ADMIN_PASSWORD=Shine@123 SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxx SUPABASE_URL=https://nhjujpwpevtukvsmvuzb.supabase.co
//
// WHY THIS EXISTS: the `applications` table deliberately has no public
// read policy — it holds candidate names, phone numbers, and emails, and
// the public anon key used by the frontend is, by nature, visible to
// anyone who opens browser dev tools on your site. A public read policy
// would mean literally anyone could pull every candidate's contact
// details directly from Supabase's REST API, no login needed.
//
// This function is the safe alternative: it uses the SERVICE ROLE key
// (which bypasses RLS) only on the server side, and only returns data
// once the caller supplies the correct admin password. The password check
// happens here, not in the browser, so the real gate is server-side.
//
// NOTE: this is still a shared static password, not real per-user
// authentication — good enough for a POC, but before this handles real
// candidate volume at scale, replace ADMIN_PASSWORD with Supabase Auth
// (admin logs in, gets a session, RLS checks their user id) so access
// isn't just "anyone who knows one shared string."
// ════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { password } = await req.json();

    if (password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabaseAdmin
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch applications:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ applications: data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
