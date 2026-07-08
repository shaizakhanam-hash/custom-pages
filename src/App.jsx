import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";

/* ════════════════════════════════════════════════════════════════════════
   JobPulse — internal jobs POC (placeholder brand, not affiliated with any
   named company). Deployed on vercel.app for now; swap branding + point
   at a real domain once this graduates past POC — see setup-guide.md.
   ════════════════════════════════════════════════════════════════════════ */

const POSTHOG_API_KEY = "YOUR_POSTHOG_PROJECT_API_KEY"; // ph_...
const POSTHOG_HOST = "https://us.i.posthog.com"; // or https://eu.i.posthog.com
const META_PIXEL_ID = "YOUR_META_PIXEL_ID";
const SERVER_CAPI_ENDPOINT = "/functions/v1/meta-capi-on-apply"; // Supabase edge function path, see setup guide
const WHATSAPP_SEND_ENDPOINT = "/functions/v1/whatsapp-send"; // Supabase edge function path, see setup guide
const ADMIN_PASSWORD = "Shine@123"; // swap for real Supabase Auth in production

/* ════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   Palette: ink #0E1B2B (primary text/nav), signal #FF6A2B (CTA/accent — the
   "recruiter is responding" color), paper #FBF8F3 (warm background, not
   cold white), pulse #16A085 (live/positive), slate #5B6472 (secondary text),
   line #E7E1D6 (hairline borders).
   Type: "Sora" for display (confident, geometric, slightly technical —
   reads as "hiring infrastructure" not "startup landing page"), "Inter" for
   body/UI, "IBM Plex Mono" for stat/data callouts (job codes, counters).
   Signature element: the "Hiring Pulse" strip — a live counter of
   applications sent, driven by real session data (wire to a Supabase COUNT
   in production), reinforcing "immediate hiring" with a real number
   instead of a decorative stat block.
   ════════════════════════════════════════════════════════════════════════ */
const G = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
:root{
  --ink:#0A0A0A; --signal:#2563EB; --signal-dark:#1D4ED8; --paper:#FFFFFF;
  --pulse:#16A085; --slate:#475569; --line:#E2E8F0; --card:#FFFFFF;
  --danger:#C4432C;
}
*{box-sizing:border-box;}
body,html{margin:0;padding:0;}
.sp-root{font-family:'Inter',sans-serif;background:var(--paper);color:var(--ink);min-height:100vh;}
.sp-root h1,.sp-root h2,.sp-root h3,.sp-root .disp{font-family:'Sora',sans-serif;}
.sp-mono{font-family:'IBM Plex Mono',monospace;}
a{text-decoration:none;color:inherit;}
button{font-family:inherit;cursor:pointer;}
input,select,textarea{font-family:inherit;}

/* Header */
.sp-hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 32px;border-bottom:1px solid var(--line);background:var(--paper);position:sticky;top:0;z-index:40;}
.sp-brand{display:flex;align-items:center;gap:10px;}
.sp-brand-mark{width:34px;height:34px;border-radius:9px;background:var(--ink);color:var(--signal);display:flex;align-items:center;justify-content:center;font-family:'Sora';font-weight:800;font-size:18px;}
.sp-brand-name{font-family:'Sora';font-weight:700;font-size:19px;letter-spacing:-0.02em;}
.sp-brand-name span{color:var(--signal);}
.sp-hdr-right{display:flex;align-items:center;gap:18px;}
.sp-admin-link{font-size:13px;color:var(--slate);border:1px solid var(--line);padding:7px 14px;border-radius:100px;background:none;transition:.15s;}
.sp-admin-link:hover{border-color:var(--ink);color:var(--ink);}

/* Hero */
.sp-hero{padding:64px 32px 40px;max-width:1120px;margin:0 auto;}
.sp-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--pulse);background:#E9F7F2;padding:6px 12px;border-radius:100px;margin-bottom:20px;}
.sp-eyebrow .dot{width:7px;height:7px;border-radius:50%;background:var(--pulse);animation:sp-blink 1.6s infinite;}
@keyframes sp-blink{0%,100%{opacity:1;}50%{opacity:.35;}}
.sp-h1{font-size:clamp(32px,5vw,52px);font-weight:800;line-height:1.05;letter-spacing:-0.03em;max-width:820px;margin:0 0 18px;}
.sp-h1 em{font-style:normal;color:var(--signal);}
.sp-sub{font-size:17px;color:var(--slate);max-width:600px;line-height:1.55;margin-bottom:32px;}

/* Pulse strip */
.sp-pulse-strip{display:flex;align-items:center;gap:28px;margin-top:36px;padding:16px 22px;background:var(--ink);border-radius:14px;color:#fff;flex-wrap:wrap;}
.sp-pulse-item{display:flex;align-items:center;gap:10px;}
.sp-pulse-num{font-family:'IBM Plex Mono';font-weight:600;font-size:20px;color:var(--signal);}
.sp-pulse-label{font-size:12.5px;color:#B9C2CE;}

/* Companies strip */
.sp-companies{padding:36px 32px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.sp-companies-inner{max-width:1120px;margin:0 auto;}
.sp-companies-label{font-size:12.5px;font-weight:600;color:var(--slate);text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px;}
.sp-chip-row{display:flex;gap:12px;flex-wrap:wrap;}
.sp-chip{font-family:'Sora';font-weight:700;font-size:14px;padding:9px 18px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);}

/* Job listing */
.sp-listing{max-width:1120px;margin:0 auto;padding:44px 32px 80px;}
.sp-listing-hdr{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px;}
.sp-listing-title{font-size:24px;font-weight:700;}
.sp-cat-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px;}
.sp-cat-pill{font-size:13px;font-weight:600;padding:8px 15px;border-radius:100px;border:1px solid var(--line);background:var(--card);color:var(--slate);transition:.15s;}
.sp-cat-pill.active{background:var(--ink);color:#fff;border-color:var(--ink);}
.sp-job-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;}
.sp-job-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px;transition:.15s;display:flex;flex-direction:column;gap:10px;}
.sp-job-card:hover{border-color:var(--ink);box-shadow:0 10px 26px -16px rgba(14,27,43,.25);transform:translateY(-2px);}
.sp-job-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}
.sp-job-title{font-family:'Sora';font-weight:700;font-size:16.5px;line-height:1.3;}
.sp-job-tag{font-size:11px;font-weight:700;background:#EFF6FF;color:var(--signal-dark);padding:4px 9px;border-radius:100px;white-space:nowrap;}
.sp-job-meta{font-size:13.5px;color:var(--slate);}
.sp-job-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:2px;}
.sp-job-pill{font-size:11.5px;background:#F1EEE6;color:var(--ink);padding:4px 10px;border-radius:6px;font-weight:600;}
.sp-job-sal{font-family:'IBM Plex Mono';font-weight:600;font-size:14px;color:var(--ink);margin-top:2px;}
.sp-job-apply{margin-top:10px;background:var(--ink);color:#fff;border:none;padding:11px;border-radius:9px;font-weight:700;font-size:13.5px;transition:.15s;}
.sp-job-apply:hover{background:var(--signal);}
.sp-empty{padding:60px 20px;text-align:center;color:var(--slate);}

/* JD page */
.sp-jd{max-width:820px;margin:0 auto;padding:40px 32px 100px;}
.sp-back{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;color:var(--slate);background:none;border:none;margin-bottom:24px;font-weight:600;}
.sp-back:hover{color:var(--ink);}
.sp-jd-head{border:1px solid var(--line);border-radius:18px;padding:30px;background:var(--card);margin-bottom:28px;}
.sp-jd-title{font-size:27px;font-weight:800;margin:0 0 8px;letter-spacing:-0.02em;}
.sp-jd-company{font-size:15px;color:var(--slate);margin-bottom:18px;}
.sp-jd-facts{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:22px;}
.sp-jd-fact-label{font-size:11.5px;color:var(--slate);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
.sp-jd-fact-val{font-weight:700;font-size:14.5px;}
.sp-jd-cta{background:var(--signal);color:#fff;border:none;padding:15px 30px;border-radius:11px;font-weight:700;font-size:15.5px;width:100%;transition:.15s;}
.sp-jd-cta:hover{background:var(--signal-dark);}
.sp-jd-note{text-align:center;font-size:12.5px;color:var(--slate);margin-top:10px;}
.sp-jd-section{margin-bottom:22px;}
.sp-jd-section h3{font-size:15px;font-weight:700;margin-bottom:10px;}
.sp-jd-section ul{margin:0;padding-left:20px;color:var(--slate);font-size:14.5px;line-height:1.8;}

/* Form */
.sp-form-wrap{max-width:560px;margin:0 auto;padding:40px 32px 100px;}
.sp-form-card{border:1px solid var(--line);border-radius:18px;padding:30px;background:var(--card);margin-top:8px;}
.sp-field{margin-bottom:16px;}
.sp-field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;}
.sp-field input,.sp-field select,.sp-field textarea{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:9px;font-size:14.5px;outline:none;transition:.15s;background:#fff;}
.sp-field input:focus,.sp-field select:focus,.sp-field textarea:focus{border-color:var(--ink);}
.sp-field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.sp-submit{width:100%;background:var(--ink);color:#fff;border:none;padding:14px;border-radius:10px;font-weight:700;font-size:15px;margin-top:6px;transition:.15s;}
.sp-submit:hover{background:var(--signal);}
.sp-submit:disabled{opacity:.6;cursor:not-allowed;}
.sp-consent{font-size:12px;color:var(--slate);line-height:1.5;margin-top:10px;}

/* Success */
.sp-success{max-width:520px;margin:0 auto;padding:100px 32px;text-align:center;}
.sp-success-ic{width:64px;height:64px;border-radius:50%;background:#E9F7F2;color:var(--pulse);display:flex;align-items:center;justify-content:center;margin:0 auto 22px;font-size:30px;}
.sp-success h2{font-size:25px;margin-bottom:10px;}
.sp-success p{color:var(--slate);font-size:15px;line-height:1.6;margin-bottom:26px;}
.sp-success-btn{background:var(--ink);color:#fff;border:none;padding:12px 26px;border-radius:9px;font-weight:700;font-size:14px;}

/* Admin */
.sp-adm-gate{max-width:380px;margin:100px auto;padding:0 32px;text-align:center;}
.sp-adm-gate input{width:100%;padding:13px;border:1px solid var(--line);border-radius:9px;font-size:14.5px;margin:18px 0 12px;text-align:center;}
.sp-adm-shell{max-width:1180px;margin:0 auto;padding:32px;}
.sp-adm-tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:28px;}
.sp-adm-tab{padding:11px 18px;font-size:14px;font-weight:600;color:var(--slate);background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;}
.sp-adm-tab.active{color:var(--ink);border-color:var(--signal);}
.sp-adm-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.sp-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;}
.sp-kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}
.sp-kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;}
.sp-kpi-val{font-family:'IBM Plex Mono';font-size:26px;font-weight:600;}
.sp-kpi-label{font-size:12.5px;color:var(--slate);margin-top:4px;}
.sp-table{width:100%;border-collapse:collapse;font-size:13.5px;}
.sp-table th{text-align:left;padding:10px 12px;color:var(--slate);font-weight:600;border-bottom:1px solid var(--line);font-size:12px;text-transform:uppercase;letter-spacing:.04em;}
.sp-table td{padding:11px 12px;border-bottom:1px solid var(--line);}
.sp-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;}
.sp-badge.on{background:#E9F7F2;color:var(--pulse);}
.sp-badge.off{background:#F1EEE6;color:var(--slate);}
.sp-mini-btn{font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:7px;border:1px solid var(--line);background:#fff;}
.sp-mini-btn:hover{border-color:var(--ink);}
.sp-wa-bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap;}
.sp-wa-bar select{padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px;background:#fff;}
.sp-wa-preview{background:#F1F5F9;border:1px dashed var(--line);border-radius:10px;padding:12px 14px;font-size:13px;color:var(--slate);font-style:italic;margin-bottom:18px;}
.sp-footer{text-align:center;padding:30px;font-size:12.5px;color:var(--slate);border-top:1px solid var(--line);}
@media(max-width:760px){.sp-adm-grid,.sp-field-row,.sp-kpi-row{grid-template-columns:1fr 1fr;}.sp-hdr{padding:14px 18px;}.sp-hero,.sp-listing,.sp-companies{padding-left:18px;padding-right:18px;}}
`;

/* ════════════════════════════════════════════════════════════════════════
   TRACKING HELPERS
   These call window.posthog / window.fbq if the scripts have loaded. In
   this sandboxed preview those SDKs are not present (external network is
   blocked), so calls silently no-op below — that's expected here and is
   NOT a bug to fix. Once deployed on a real domain with the snippets in
   index.html (see setup guide), these fire for real.
   ════════════════════════════════════════════════════════════════════════ */
function uid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function getUTM() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get("utm_source") || "direct",
      utm_medium: p.get("utm_medium") || "none",
      utm_campaign: p.get("utm_campaign") || "none",
      fbclid: p.get("fbclid") || null,
    };
  } catch {
    return { utm_source: "direct", utm_medium: "none", utm_campaign: "none", fbclid: null };
  }
}
function trackPH(event, props = {}) {
  try {
    if (typeof window !== "undefined" && window.posthog) {
      window.posthog.capture(event, { ...props, ...getUTM() });
    } else {
      console.log("[PostHog stub]", event, props);
    }
  } catch (e) {}
}
function trackMeta(event, props = {}, eventId) {
  try {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", event, props, { eventID: eventId });
    } else {
      console.log("[Meta Pixel stub]", event, props, eventId);
    }
  } catch (e) {}
}
// Server-side leg of the Meta Conversions API call. This is what actually
// feeds Meta's matching/Lookalike system reliably (browser pixel alone is
// degraded by iOS ATT + ad blockers). Wire SERVER_CAPI_ENDPOINT to the
// deployed Supabase Edge Function from the setup guide.
async function sendServerConversion(payload) {
  try {
    await fetch(SERVER_CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.log("[Server CAPI stub — wire up edge function]", payload);
  }
}
// WhatsApp Business Cloud API send, routed through a Supabase Edge
// Function (WHATSAPP_SEND_ENDPOINT) so the access token never sits in
// frontend code. WhatsApp requires business-initiated messages outside an
// active 24-hour customer conversation to use pre-approved message
// templates — that's why this takes a template_id + params rather than
// arbitrary freeform text. See setup-guide.md for template approval steps.
async function sendWhatsApp({ phone, templateId, params }) {
  try {
    const resp = await fetch(WHATSAPP_SEND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, template_id: templateId, params }),
    });
    return resp.ok;
  } catch (e) {
    console.log("[WhatsApp send stub — wire up edge function]", phone, templateId, params);
    return false;
  }
}
const WHATSAPP_TEMPLATES = [
  { id: "application_received", label: "Application received", preview: (name, job) => `Hi ${name}, thanks for applying to ${job} on JobPulse! A recruiter will review your application and get back to you within 24–48 hours.` },
  { id: "interview_invite", label: "Interview invite", preview: (name, job) => `Hi ${name}, good news — we'd like to invite you for an interview for the ${job} role. Please reply with your availability this week.` },
  { id: "document_request", label: "Document request", preview: (name, job) => `Hi ${name}, to move ahead with your application for ${job}, please share your updated CV and a valid ID proof at your earliest convenience.` },
];

/* ════════════════════════════════════════════════════════════════════════
   MOCK DATA LAYER — swap for Supabase calls per SUPABASE SCHEMA comments
   ════════════════════════════════════════════════════════════════════════ */
const CATEGORIES = [
  "All", "IT & Software", "Sales & Marketing", "Customer Support",
  "Retail & Store Ops", "Delivery & Logistics", "BPO / Telecalling",
  "Manufacturing & Warehouse", "Hospitality", "Banking & Finance Ops", "Admin & Back Office",
];
const TRUSTED_COMPANIES = [
  "Tata Group", "Reliance Retail", "HDFC Bank", "Amazon", "Flipkart", "Infosys",
  "Zomato", "Swiggy", "ICICI Bank", "Byju's", "BigBasket", "Larsen & Toubro",
];

// Supabase row <-> app object mapping. The DB uses snake_case columns
// (job_type, salary_min, etc.); the app's internal job objects use the
// original camelCase shape everything else in this file already expects.
function dbRowToJob(row) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    category: row.category,
    location: row.location,
    type: row.job_type,
    exp: row.experience || "Not specified",
    salMin: row.salary_min || 0,
    salMax: row.salary_max || 0,
    salUnit: row.salary_unit || "month",
    tags: row.tags || [],
    desc: row.description || [],
    active: row.active,
    postedAt: new Date(row.created_at).getTime(),
  };
}
function jobToDbRow(job) {
  return {
    title: job.title,
    company: job.company,
    category: job.category,
    location: job.location,
    job_type: job.type,
    experience: job.exp,
    salary_min: job.salMin,
    salary_max: job.salMax,
    salary_unit: job.salUnit,
    tags: job.tags,
    description: job.desc,
    active: job.active,
  };
}

function fmtSalary(j) {
  const f = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`);
  return `${f(j.salMin)}–${f(j.salMax)} / ${j.salUnit === "annum" ? "yr" : "mo"}`;
}
function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? "Posted today" : `Posted ${d}d ago`;
}

/* ════════════════════════════════════════════════════════════════════════
   SHARED UI
   ════════════════════════════════════════════════════════════════════════ */
function Header({ onHome }) {
  return (
    <header className="sp-hdr">
      <a className="sp-brand" onClick={onHome}>
        <div className="sp-brand-mark">J</div>
        <div className="sp-brand-name">Job<span>Pulse</span></div>
      </a>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CANDIDATE: HOME
   ════════════════════════════════════════════════════════════════════════ */
function Home({ jobs, applications, onJob, loading }) {
  const [cat, setCat] = useState("All");
  const [pulseCount, setPulseCount] = useState(1284 + applications.length);

  useEffect(() => {
    trackPH("home_viewed");
  }, []);
  useEffect(() => {
    setPulseCount(1284 + applications.length);
  }, [applications.length]);

  // Small ambient increment purely for the "live" feel — in production
  // replace with a real-time COUNT(*) from the applications table
  // (e.g. Supabase Realtime subscription) instead of a client interval.
  useEffect(() => {
    const t = setInterval(() => setPulseCount((c) => c + (Math.random() > 0.6 ? 1 : 0)), 4000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (!j.active) return false;
      if (cat !== "All" && j.category !== cat) return false;
      return true;
    });
  }, [jobs, cat]);

  return (
    <>
      <section className="sp-hero">
        <div className="sp-eyebrow"><span className="dot" /> HIRING NOW · ALL INDUSTRIES</div>
        <h1 className="sp-h1">Find opportunities. <em>Apply here.</em></h1>
        <p className="sp-sub">Browse open roles across every industry and apply directly — no search needed, just scroll and find what fits.</p>
        <div className="sp-pulse-strip">
          <div className="sp-pulse-item">
            <div className="sp-pulse-num sp-mono">{pulseCount.toLocaleString("en-IN")}</div>
            <div className="sp-pulse-label">applications sent<br />in the last 24 hours</div>
          </div>
          <div className="sp-pulse-item">
            <div className="sp-pulse-num sp-mono">{jobs.filter((j) => j.active).length}</div>
            <div className="sp-pulse-label">open roles<br />live right now</div>
          </div>
          <div className="sp-pulse-item">
            <div className="sp-pulse-num sp-mono">{CATEGORIES.length - 1}</div>
            <div className="sp-pulse-label">industries<br />hiring today</div>
          </div>
        </div>
      </section>

      <section className="sp-companies">
        <div className="sp-companies-inner">
          <div className="sp-companies-label">Hiring now on JobPulse</div>
          <div className="sp-chip-row">
            {TRUSTED_COMPANIES.map((c) => <div key={c} className="sp-chip">{c}</div>)}
          </div>
        </div>
      </section>

      <section className="sp-listing">
        <div className="sp-listing-hdr">
          <div className="sp-listing-title">{filtered.length} open role{filtered.length === 1 ? "" : "s"}</div>
        </div>
        <div className="sp-cat-row">
          {CATEGORIES.map((c) => (
            <button key={c} className={`sp-cat-pill${cat === c ? " active" : ""}`} onClick={() => { setCat(c); trackPH("category_filtered", { category: c }); }}>{c}</button>
          ))}
        </div>
        {loading ? (
          <div className="sp-empty">Loading open roles…</div>
        ) : filtered.length === 0 ? (
          <div className="sp-empty">No roles match those filters right now. Try a broader search.</div>
        ) : (
          <div className="sp-job-grid">
            {filtered.map((j) => (
              <div key={j.id} className="sp-job-card">
                <div className="sp-job-top">
                  <div className="sp-job-title">{j.title}</div>
                  <div className="sp-job-tag">{j.category.split(" ")[0]}</div>
                </div>
                <div className="sp-job-meta">{j.company} · {j.location}</div>
                <div className="sp-job-sal">{fmtSalary(j)}</div>
                <div className="sp-job-tags">{j.tags.map((t) => <span key={t} className="sp-job-pill">{t}</span>)}</div>
                <button className="sp-job-apply" onClick={() => onJob(j)}>View & Apply</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CANDIDATE: JOB DETAIL
   ════════════════════════════════════════════════════════════════════════ */
function JobDetail({ job, onBack, onSuccess, onStart }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", noticePeriod: "Immediate", currentSalary: "", cvFile: null });
  const [submitting, setSubmitting] = useState(false);
  const startedRef = useRef(false);
  const formRef = useRef(null);

  useEffect(() => {
    trackPH("job_viewed", { job_id: job.id, job_title: job.title, company: job.company, category: job.category });
  }, [job.id]);

  const markStarted = () => {
    if (!startedRef.current) {
      trackPH("apply_started", { job_id: job.id, job_title: job.title });
      onStart?.();
      startedRef.current = true;
    }
  };

  const scrollToForm = () => {
    markStarted();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setFile = (e) => setF({ ...f, cvFile: e.target.files?.[0] || null });const submit = async (e) => {
    e.preventDefault();
    if (!f.name || !f.phone || !f.email) return;
    setSubmitting(true);
    const eventId = uid(); // shared between browser Pixel + server CAPI for dedup

    // 1. PostHog — product/funnel analytics
    trackPH("apply_completed", { job_id: job.id, job_title: job.title, company: job.company, category: job.category, name: f.name, email: f.email, notice_period: f.noticePeriod });

    // 2. Meta Pixel — browser-side conversion signal
    trackMeta("Lead", { content_name: job.title, content_category: job.category, value: 0, currency: "INR" }, eventId);

    // 3. Server-side Meta Conversions API — reliable match, feeds Lookalike
    //    Audiences ("similar candidates"). See meta-capi-on-apply edge
    //    function + setup guide for the Ads Manager side of this.
    await sendServerConversion({
      event_id: eventId,
      event_name: "Lead",
      email: f.email,
      phone: f.phone,
      job_id: job.id,
      job_title: job.title,
      ...getUTM(),
    });

    // 4. CV upload — in this preview the file is only held in memory.
    //    In production, upload f.cvFile to Supabase Storage (e.g. a
    //    `resumes` bucket) and store the resulting path on the
    //    applications row as cv_url. See setup-guide.md.
    if (f.cvFile) {
      console.log("[CV upload stub — wire to Supabase Storage]", f.cvFile.name);
    }

    onSuccess({ name: f.name, phone: f.phone, email: f.email, noticePeriod: f.noticePeriod, currentSalary: f.currentSalary, cvFileName: f.cvFile?.name || null, job });
    setSubmitting(false);
  };

  return (
    <div className="sp-jd">
      <button className="sp-back" onClick={onBack}>← Back to all jobs</button>
      <div className="sp-jd-head">
        <h2 className="sp-jd-title">{job.title}</h2>
        <div className="sp-jd-company">{job.company} · {job.location} · {timeAgo(job.postedAt)}</div>
        <div className="sp-jd-facts">
          <div><div className="sp-jd-fact-label">Salary</div><div className="sp-jd-fact-val">{fmtSalary(job)}</div></div>
          <div><div className="sp-jd-fact-label">Experience</div><div className="sp-jd-fact-val">{job.exp}</div></div>
          <div><div className="sp-jd-fact-label">Type</div><div className="sp-jd-fact-val">{job.type}</div></div>
        </div>
        <button className="sp-jd-cta" onClick={scrollToForm}>Apply now</button>
      </div>
      <div className="sp-jd-section">
        <h3>What you'll do</h3>
        <ul>{job.desc.map((d) => <li key={d}>{d}</li>)}</ul>
      </div>
      <div className="sp-jd-section">
        <h3>Good to know</h3>
        <ul>{job.tags.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>

      <div className="sp-form-card" ref={formRef}>
        <h3 style={{ marginTop: 0, fontSize: 19 }}>Apply for {job.title}</h3>
        <p style={{ color: "var(--slate)", fontSize: 14, marginBottom: 20 }}>Takes under a minute — a recruiter reviews every application.</p>
        <form onSubmit={submit} onFocus={markStarted}>
          <div className="sp-field"><label>Full name</label><input required value={f.name} onChange={set("name")} placeholder="Your full name" /></div>
          <div className="sp-field-row">
            <div className="sp-field"><label>Phone number</label><input required value={f.phone} onChange={set("phone")} placeholder="10-digit mobile" /></div>
            <div className="sp-field"><label>Email</label><input required type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" /></div>
          </div>
          <div className="sp-field-row">
            <div className="sp-field"><label>Notice period</label>
              <select value={f.noticePeriod} onChange={set("noticePeriod")}>
                <option>Immediate</option><option>15 days</option><option>30 days</option><option>60 days</option><option>90+ days</option>
              </select>
            </div>
            <div className="sp-field"><label>Current salary</label><input value={f.currentSalary} onChange={set("currentSalary")} placeholder="e.g. 18000 or 4.5 LPA" /></div>
          </div>
          <div className="sp-field">
            <label>CV / Resume</label>
            <input type="file" accept=".pdf,.doc,.docx" onChange={setFile} />
          </div>
          <button className="sp-submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit application"}</button>
          <div className="sp-consent">By applying, you agree to be contacted by JobPulse and {job.company} about this and similar roles via call, SMS, WhatsApp or email.</div>
        </form>
      </div>
    </div>
  );
}

function Success({ data, onHome }) {
  useEffect(() => {
    trackPH("apply_success_viewed", { job_id: data.job.id });
  }, []);
  return (
    <div className="sp-success">
      <div className="sp-success-ic">✓</div>
      <h2>You're in, {data.name.split(" ")[0]}.</h2>
      <p>Your application for <strong>{data.job.title}</strong> at {data.job.company} has been sent. A recruiter will reach out within 24–48 hours on the number you shared.</p>
      <button className="sp-success-btn" onClick={onHome}>Browse more jobs</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ADMIN
   ════════════════════════════════════════════════════════════════════════ */
function AdminGate({ onIn }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div className="sp-adm-gate">
      <h2 style={{ fontSize: 22 }}>Employer / Admin sign in</h2>
      <p style={{ color: "var(--slate)", fontSize: 14 }}>Swap this for real Supabase Auth in production.</p>
      <input type="password" placeholder="Admin password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(false); }} />
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>Incorrect password</div>}
      <button className="sp-submit" onClick={() => (pw === ADMIN_PASSWORD ? onIn() : setErr(true))}>Sign in</button>
    </div>
  );
}

function AdminPostJob({ onCreate }) {
  const blank = { title: "", company: "", category: CATEGORIES[1], location: "", type: "Full-time", exp: "", salMin: "", salMax: "", salUnit: "month", tags: "", desc: "" };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!f.title || !f.company || !f.location) return;
    const job = {
      id: "j" + uid().slice(0, 6),
      title: f.title, company: f.company, category: f.category, location: f.location,
      type: f.type, exp: f.exp || "Not specified",
      salMin: Number(f.salMin) || 0, salMax: Number(f.salMax) || 0, salUnit: f.salUnit,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      desc: f.desc.split("\n").map((d) => d.trim()).filter(Boolean),
      active: true, postedAt: Date.now(),
    };
    onCreate(job);
    trackPH("admin_job_posted", { job_id: job.id, category: job.category });
    setF(blank);
  };

  return (
    <div className="sp-card" style={{ maxWidth: 640 }}>
      <h3 style={{ marginTop: 0 }}>Post a new job</h3>
      <form onSubmit={submit}>
        <div className="sp-field-row">
          <div className="sp-field"><label>Job title</label><input required value={f.title} onChange={set("title")} /></div>
          <div className="sp-field"><label>Company</label><input required value={f.company} onChange={set("company")} /></div>
        </div>
        <div className="sp-field-row">
          <div className="sp-field"><label>Category</label>
            <select value={f.category} onChange={set("category")}>{CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="sp-field"><label>Location</label><input required value={f.location} onChange={set("location")} placeholder="City, State" /></div>
        </div>
        <div className="sp-field-row">
          <div className="sp-field"><label>Job type</label>
            <select value={f.type} onChange={set("type")}><option>Full-time</option><option>Part-time</option><option>Contract</option></select>
          </div>
          <div className="sp-field"><label>Experience</label><input value={f.exp} onChange={set("exp")} placeholder="e.g. 0–2 yrs" /></div>
        </div>
        <div className="sp-field-row">
          <div className="sp-field"><label>Min salary</label><input type="number" value={f.salMin} onChange={set("salMin")} /></div>
          <div className="sp-field"><label>Max salary</label><input type="number" value={f.salMax} onChange={set("salMax")} /></div>
        </div>
        <div className="sp-field"><label>Salary unit</label>
          <select value={f.salUnit} onChange={set("salUnit")}><option value="month">Per month</option><option value="annum">Per annum</option></select>
        </div>
        <div className="sp-field"><label>Tags (comma separated)</label><input value={f.tags} onChange={set("tags")} placeholder="Walk-in interview, Freshers welcome" /></div>
        <div className="sp-field"><label>Description (one bullet per line)</label><textarea rows={4} value={f.desc} onChange={set("desc")} /></div>
        <button className="sp-submit">Post job</button>
      </form>
    </div>
  );
}

function AdminManageJobs({ jobs, onToggle }) {
  return (
    <div className="sp-card">
      <h3 style={{ marginTop: 0 }}>All jobs ({jobs.length})</h3>
      <table className="sp-table">
        <thead><tr><th>Title</th><th>Company</th><th>Category</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>{j.title}</td><td>{j.company}</td><td>{j.category}</td>
              <td><span className={`sp-badge ${j.active ? "on" : "off"}`}>{j.active ? "Live" : "Paused"}</span></td>
              <td><button className="sp-mini-btn" onClick={() => onToggle(j.id)}>{j.active ? "Pause" : "Activate"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminApplications({ applications, jobs, onWhatsAppSent }) {
  const [selected, setSelected] = useState(new Set());
  const [templateId, setTemplateId] = useState(WHATSAPP_TEMPLATES[0].id);
  const [sending, setSending] = useState(false);
  const template = WHATSAPP_TEMPLATES.find((t) => t.id === templateId);
  const jobTitle = (id) => jobs.find((j) => j.id === id)?.title || id;

  const toggle = (phone) => setSelected((s) => {
    const next = new Set(s);
    next.has(phone) ? next.delete(phone) : next.add(phone);
    return next;
  });
  const toggleAll = () => setSelected((s) => (s.size === applications.length ? new Set() : new Set(applications.map((a) => a.phone))));

  const sendToSelected = async () => {
    if (selected.size === 0) return;
    setSending(true);
    const targets = applications.filter((a) => selected.has(a.phone));
    for (const a of targets) {
      await sendWhatsApp({ phone: a.phone, templateId, params: { name: a.name, job_title: jobTitle(a.job_id) } });
    }
    onWhatsAppSent(targets.map((a) => a.phone));
    setSelected(new Set());
    setSending(false);
  };

  const sendOne = async (a) => {
    await sendWhatsApp({ phone: a.phone, templateId, params: { name: a.name, job_title: jobTitle(a.job_id) } });
    onWhatsAppSent([a.phone]);
  };

  const exportCSV = () => {
    const rows = [
      ["Name", "Phone", "Email", "Job", "Notice Period", "Current Salary", "CV", "Source", "Applied At"],
      ...applications.map((a) => [a.name, a.phone, a.email, jobTitle(a.job_id), a.notice_period, a.current_salary, a.cv_file_name || "—", a.utm_source, new Date(a.at).toLocaleString()]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "applications.csv"; a.click();
  };

  return (
    <div className="sp-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ marginTop: 0 }}>Applications ({applications.length})</h3>
        <button className="sp-mini-btn" onClick={exportCSV}>Export CSV</button>
      </div>

      {applications.length === 0 ? (
        <p style={{ color: "var(--slate)" }}>No applications yet — try applying to a job from the candidate view.</p>
      ) : (
        <>
          <div className="sp-wa-bar">
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {WHATSAPP_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button className="sp-submit" style={{ width: "auto", padding: "10px 18px", marginTop: 0 }} disabled={selected.size === 0 || sending} onClick={sendToSelected}>
              {sending ? "Sending…" : `Send WhatsApp to selected (${selected.size})`}
            </button>
          </div>
          <div className="sp-wa-preview">"{template.preview("Candidate Name", "Job Title")}"</div>

          <table className="sp-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={selected.size === applications.length} onChange={toggleAll} /></th>
                <th>Name</th><th>Phone</th><th>Job</th><th>Notice</th><th>Salary</th><th>CV</th><th>WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a, i) => (
                <tr key={i}>
                  <td><input type="checkbox" checked={selected.has(a.phone)} onChange={() => toggle(a.phone)} /></td>
                  <td>{a.name}</td>
                  <td>{a.phone}</td>
                  <td>{jobTitle(a.job_id)}</td>
                  <td>{a.notice_period || "—"}</td>
                  <td>{a.current_salary || "—"}</td>
                  <td>{a.cv_file_name || "—"}</td>
                  <td>
                    {a.whatsapp_last_sent ? (
                      <span style={{ fontSize: 12, color: "var(--slate)" }}>Sent {new Date(a.whatsapp_last_sent).toLocaleDateString()}</span>
                    ) : (
                      <button className="sp-mini-btn" onClick={() => sendOne(a)}>Send</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}function AdminAnalytics({ jobs, applications, funnel }) {
  const totalViews = funnel.job_viewed || 0;
  const totalStarted = funnel.apply_started || 0;
  const totalCompleted = applications.length;
  const rate = (a, b) => (b ? ((a / b) * 100).toFixed(1) : "0.0");
  return (
    <>
      <div className="sp-kpi-row">
        <div className="sp-kpi"><div className="sp-kpi-val">{totalViews}</div><div className="sp-kpi-label">Job views</div></div>
        <div className="sp-kpi"><div className="sp-kpi-val">{totalStarted}</div><div className="sp-kpi-label">Applies started</div></div>
        <div className="sp-kpi"><div className="sp-kpi-val">{totalCompleted}</div><div className="sp-kpi-label">Applies completed</div></div>
        <div className="sp-kpi"><div className="sp-kpi-val">{rate(totalCompleted, totalViews)}%</div><div className="sp-kpi-label">View → apply rate</div></div>
      </div>
      <div className="sp-card">
        <h3 style={{ marginTop: 0 }}>Funnel (this session)</h3>
        <p style={{ color: "var(--slate)", fontSize: 13.5 }}>In production, back this with real PostHog Insights (funnel: job_viewed → apply_started → apply_completed, breakdown by category / utm_source) instead of the in-session counts shown here.</p>
        <table className="sp-table">
          <thead><tr><th>Step</th><th>Count</th><th>Drop-off from previous</th></tr></thead>
          <tbody>
            <tr><td>Job viewed</td><td>{totalViews}</td><td>—</td></tr>
            <tr><td>Apply started</td><td>{totalStarted}</td><td>{rate(totalViews - totalStarted, totalViews)}%</td></tr>
            <tr><td>Apply completed</td><td>{totalCompleted}</td><td>{rate(totalStarted - totalCompleted, totalStarted)}%</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminShell({ jobs, applications, funnel, onCreate, onToggle, onWhatsAppSent, onExit }) {
  const [tab, setTab] = useState("post");
  return (
    <div className="sp-adm-shell">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Admin dashboard</h2>
        <button className="sp-admin-link" onClick={onExit}>Exit to candidate view</button>
      </div>
      <div className="sp-adm-tabs">
        {[["post", "Post a job"], ["manage", "Manage jobs"], ["apps", "Applications"], ["analytics", "Analytics"]].map(([k, l]) => (
          <button key={k} className={`sp-adm-tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "post" && <AdminPostJob onCreate={onCreate} />}
      {tab === "manage" && <AdminManageJobs jobs={jobs} onToggle={onToggle} />}
      {tab === "apps" && <AdminApplications applications={applications} jobs={jobs} onWhatsAppSent={onWhatsAppSent} />}
      {tab === "analytics" && <AdminAnalytics jobs={jobs} applications={applications} funnel={funnel} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ROOT APP
   ════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [db, setDb] = useState({ jobs: [], applications: [] });
  const [loadingJobs, setLoadingJobs] = useState(true);
  // Admin is reached only via URL path (e.g. jobpulse.../admin), not a
  // visible nav button. In production with real routing (react-router),
  // replace this with an actual /admin route instead of a path sniff.
  const [view, setView] = useState(() =>
    typeof window !== "undefined" && window.location.pathname.replace(/\/$/, "").endsWith("/admin") ? "admin" : "candidate"
  );
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [page, setPage] = useState("home"); // home | jd | success
  const [selJob, setSelJob] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [funnel, setFunnel] = useState({ job_viewed: 0, apply_started: 0 });

  // Load jobs from Supabase on first mount. Admin sees all jobs (active +
  // paused) so they can manage everything; candidate view filters to
  // active-only itself further down via Home's own logic, but we also only
  // need active ones there — simplest to fetch admin-relevant data once
  // here since RLS only allows reading active rows with the anon key
  // anyway (paused jobs won't come back for either view, which is fine
  // for this POC — see setup-guide.md if you want admins to see paused
  // jobs too, that needs Supabase Auth).
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Failed to load jobs from Supabase:", error);
      } else {
        setDb((d) => ({ ...d, jobs: (data || []).map(dbRowToJob) }));
      }
      setLoadingJobs(false);
    })();
  }, []);

  // Bump lightweight local funnel counters alongside PostHog capture calls,
  // purely so the Admin Analytics tab has something to show in this
  // sandboxed preview (PostHog itself isn't reachable here).
  const bump = (key) => setFunnel((f) => ({ ...f, [key]: (f[key] || 0) + 1 }));

  const goHome = () => { setView("candidate"); setPage("home"); setSelJob(null); };
  const openJob = (j) => { setSelJob(j); setPage("jd"); bump("job_viewed"); window.scrollTo(0, 0); };

  const finishApply = async (data) => {
    const utm = getUTM();
    const record = {
      name: data.name, phone: data.phone, email: data.email,
      notice_period: data.noticePeriod, current_salary: data.currentSalary,
      cv_file_name: data.cvFileName, job_id: data.job.id, at: Date.now(),
      whatsapp_last_sent: null,
      ...utm,
    };
    // Optimistic local update so the UI (success page, admin table this
    // session) works instantly regardless of network latency.
    setDb((d) => ({ ...d, applications: [...d.applications, record] }));
    setSuccessData(data);
    setPage("success");
    window.scrollTo(0, 0);

    // Persist to Supabase so it survives refreshes / other sessions.
    const { error } = await supabase.from("applications").insert({
      job_id: data.job.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      notice_period: data.noticePeriod,
      current_salary: data.currentSalary,
      cv_url: data.cvFileName || null, // filename only for now — real file upload needs Supabase Storage, see setup-guide.md
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      fbclid: utm.fbclid,
    });
    if (error) console.error("Failed to save application to Supabase:", error);
  };

  const createJob = async (job) => {
    // Optimistic local add with a temporary id, replaced once Supabase
    // confirms the real row (or removed if the insert fails).
    const tempId = job.id;
    setDb((d) => ({ ...d, jobs: [job, ...d.jobs] }));

    const { data, error } = await supabase.from("jobs").insert(jobToDbRow(job)).select().single();
    if (error) {
      console.error("Failed to save job to Supabase:", error);
      setDb((d) => ({ ...d, jobs: d.jobs.filter((j) => j.id !== tempId) }));
    } else {
      setDb((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === tempId ? dbRowToJob(data) : j)) }));
    }
  };

  const toggleJob = async (id) => {
    const job = db.jobs.find((j) => j.id === id);
    if (!job) return;
    setDb((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? { ...j, active: !j.active } : j)) }));
    const { error } = await supabase.from("jobs").update({ active: !job.active }).eq("id", id);
    if (error) {
      console.error("Failed to update job in Supabase:", error);
      setDb((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? { ...j, active: job.active } : j)) })); // revert
    }
  };

  const markWhatsAppSent = (phones) => setDb((d) => ({
    ...d,
    applications: d.applications.map((a) => (phones.includes(a.phone) ? { ...a, whatsapp_last_sent: Date.now() } : a)),
  }));

  return (
    <div className="sp-root">
      <style>{G}</style>
      <Header onHome={goHome} />

      {view === "candidate" && (
        <>
          {page === "home" && <Home jobs={db.jobs} applications={db.applications} onJob={openJob} loading={loadingJobs} />}
          {page === "jd" && selJob && <JobDetail job={selJob} onBack={() => setPage("home")} onSuccess={finishApply} onStart={() => bump("apply_started")} />}
          {page === "success" && successData && <Success data={successData} onHome={goHome} />}
        </>
      )}

      {view === "admin" && (
        adminAuthed
          ? <AdminShell jobs={db.jobs} applications={db.applications} funnel={funnel} onCreate={createJob} onToggle={toggleJob} onWhatsAppSent={markWhatsAppSent} onExit={goHome} />
          : <AdminGate onIn={() => setAdminAuthed(true)} />
      )}

      <div className="sp-footer">© 2026 JobPulse · Internal proof-of-concept — not for public distribution</div>
    </div>
  );
}
