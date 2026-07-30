import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import Papa from "papaparse";

/* ════════════════════════════════════════════════════════════════════════
   JobPulse — internal jobs POC (placeholder brand, not affiliated with any
   named company). Deployed on vercel.app for now; swap branding + point
   at a real domain once this graduates past POC.
   ════════════════════════════════════════════════════════════════════════ */

const POSTHOG_API_KEY = "phc_AdNBNr4z2tTcRFqSAQM5XjJamQJjoEvEoFdBZftXhWYk";
const POSTHOG_HOST = "https://us.i.posthog.com";
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || "1221071876758000";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const WHATSAPP_SEND_ENDPOINT = `${SUPABASE_URL}/functions/v1/whatsapp-send`;
const ADMIN_DATA_ENDPOINT = `${SUPABASE_URL}/functions/v1/admin-get-applications`;
const EDGE_FN_HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "apikey": SUPABASE_ANON_KEY,
};
const ADMIN_PASSWORD = "Shine@123";

/* ════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
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
.sp-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--pulse);background:#E9F7F2;padding:6px 12px;border-radius:100py;margin-bottom:20px;}
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
.sp-share{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--line);flex-wrap:wrap;}
.sp-share-label{font-size:13px;color:var(--slate);font-weight:600;}
.sp-share-btns{display:flex;gap:10px;flex-wrap:wrap;}
.sp-share-btn{font-size:13px;font-weight:600;padding:8px 15px;border-radius:100px;border:1px solid var(--line);background:var(--card);color:var(--ink);transition:.15s;}
.sp-share-btn:hover{border-color:var(--ink);}
.sp-share-btn-wa{border-color:#25D366;color:#0F8A46;}
.sp-share-btn-wa:hover{background:#E9F9EF;border-color:#25D366;}
.sp-jd-section{margin-bottom:22px;}
.sp-jd-section h3{font-size:15px;font-weight:700;margin-bottom:10px;}
.sp-jd-section ul{margin:0;padding-left:20px;color:var(--slate);font-size:14.5px;line-height:1.8;}

/* Screening questions nudge */
.sp-screening-nudge{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:#F0F8FF;margin:16px 0;display:flex;align-items:flex-start;gap:12px;}
.sp-screening-nudge-icon{width:32px;height:32px;border-radius:50%;background:var(--signal);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;}
.sp-screening-nudge-text{display:flex;flex-direction:column;gap:2px;}
.sp-screening-nudge-label{font-weight:600;font-size:13px;color:var(--ink);}
.sp-screening-nudge-desc{font-size:12px;color:var(--slate);}

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
.sp-utm-row{margin-bottom:10px;}
.sp-utm-row-top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;}
.sp-utm-row-label{color:var(--ink);font-weight:500;}
.sp-utm-row-count{color:var(--slate);font-family:'IBM Plex Mono';}
.sp-utm-bar-track{background:#F1F5F9;border-radius:6px;height:7px;overflow:hidden;}
.sp-utm-bar-fill{background:var(--signal);height:100%;border-radius:6px;}
.sp-table{width:100%;border-collapse:collapse;font-size:13.5px;}
.sp-table th{text-align:left;padding:10px 12px;color:var(--slate);font-weight:600;border-bottom:1px solid var(--line);font-size:12px;text-transform:uppercase;letter-spacing:.04em;}
.sp-table td{padding:11px 12px;border-bottom:1px solid var(--line);}
.sp-badge{font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;}
.sp-badge.on{background:#E9F7F2;color:var(--pulse);}
.sp-badge.off{background:#F1EEE6;color:var(--slate);}
.sp-rel-badge{font-family:'IBM Plex Mono';font-size:12px;font-weight:600;padding:3px 9px;border-radius:100px;cursor:default;}
.sp-rel-badge.high{background:#E9F7F2;color:var(--pulse);}
.sp-rel-badge.mid{background:#FFF4E5;color:#B45309;}
.sp-rel-badge.low{background:#FDECEC;color:var(--danger);}
.sp-rel-badge.none{background:#F1EEE6;color:var(--slate);}
.sp-th-sort{cursor:pointer;user-select:none;}
.sp-th-sort:hover{color:var(--ink);}
.sp-mini-btn{font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:7px;border:1px solid var(--line);background:#fff;}
.sp-mini-btn:hover{border-color:var(--ink);}
.sp-wa-bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap;}
.sp-wa-bar select{padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px;background:#fff;}
.sp-wa-preview{background:#F1F5F9;border:1px dashed var(--line);border-radius:10px;padding:12px 14px;font-size:13px;color:var(--slate);font-style:italic;margin-bottom:18px;}
.sp-footer{text-align:center;padding:30px;font-size:12.5px;color:var(--slate);border-top:1px solid var(--line);}

/* Screening questions admin */
.sp-screening-list{margin-top:12px;border:1px solid var(--line);border-radius:9px;padding:12px;background:#F9FAFB;}
.sp-screening-item{display:flex;gap:10px;margin-bottom:8px;padding:10px;background:#fff;border:1px solid var(--line);border-radius:6px;align-items:center;}
.sp-screening-item:last-child{margin-bottom:0;}
.sp-screening-item input{flex:1;margin:0;padding:8px;border:none;background:transparent;font-size:13px;}
.sp-screening-checkbox{width:20px;height:20px;cursor:pointer;}
.sp-screening-remove{font-size:12px;color:var(--danger);cursor:pointer;background:none;border:none;padding:4px 8px;font-weight:600;}

@media(max-width:760px){.sp-field-row,.sp-kpi-row{grid-template-columns:1fr 1fr;}.sp-hdr{padding:14px 18px;}.sp-hero,.sp-listing,.sp-companies{padding-left:18px;padding-right:18px;}}
`;

/* ════════════════════════════════════════════════════════════════════════
   TRACKING HELPERS
   ════════════════════════════════════════════════════════════════════════ */
function uid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
const UTM_STORAGE_KEY = "sp_utm";

function captureUTM() {
  try {
    if (sessionStorage.getItem(UTM_STORAGE_KEY)) return;
    const p = new URLSearchParams(window.location.search);
    const utm = {
      utm_source: p.get("utm_source") || "direct",
      utm_medium: p.get("utm_medium") || "none",
      utm_campaign: p.get("utm_campaign") || "none",
      fbclid: p.get("fbclid") || null,
    };
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {}
}

function getUTM() {
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
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

async function sendWhatsApp({ phone, templateId, params }) {
  try {
    const resp = await fetch(WHATSAPP_SEND_ENDPOINT, {
      method: "POST",
      headers: EDGE_FN_HEADERS,
      body: JSON.stringify({ phone, template_id: templateId, params }),
    });
    return resp.ok;
  } catch (e) {
    console.log("[WhatsApp send stub]", phone, templateId, params);
    return false;
  }
}
const WHATSAPP_TEMPLATES = [
  { id: "job_promotion", label: "New job for you (with link)", preview: (name, job, company, location, exp, salary) => `Hi ${name}\nYour profile is being reviewed for ${job} at ${company} in ${location}\n\nExp required ${exp}\nSalary offered ${salary}\n\nIf interested click on the link below to register` },
  { id: "application_received", label: "Application received", preview: (name, job) => `Hi ${name}, thanks for applying to ${job} on JobPulse! A recruiter will review your application and get back to you within 24–48 hours.` },
  { id: "interview_invite", label: "Interview invite", preview: (name, job) => `Hi ${name}, good news — we'd like to invite you for an interview for the ${job} role. Please reply with your availability this week.` },
  { id: "document_request", label: "Document request", preview: (name, job) => `Hi ${name}, to move ahead with your application for ${job}, please share your updated CV and a valid ID proof at your earliest convenience.` },
];

function parseContactsCSV(file, onDone) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const parsed = (results.data || [])
        .map((row) => {
          const keys = Object.keys(row);
          const nameKey = keys.find((k) => k.toLowerCase().includes("name"));
          const phoneKey = keys.find((k) => /phone|mobile|number/.test(k.toLowerCase()));
          return {
            name: (nameKey ? row[nameKey] : "")?.toString().trim() || "Candidate",
            phone: (phoneKey ? row[phoneKey] : "")?.toString().trim() || "",
          };
        })
        .filter((c) => c.phone);
      onDone(parsed);
    },
  });
}

function parseContactsText(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [first, second] = line.split(",").map((s) => s.trim());
      const phone = (second || first || "").replace(/[^\d+]/g, "");
      const name = second ? first : "Candidate";
      return { name: name || "Candidate", phone };
    })
    .filter((c) => c.phone);
}

/* ════════════════════════════════════════════════════════════════════════
   DATA LAYER
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
    mustHave: row.must_have || [],
    goodToHave: row.good_to_have || [],
    education: row.education || [],
    jobTag: row.job_tag || null,
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
    must_have: job.mustHave,
    good_to_have: job.goodToHave,
    education: job.education,
    job_tag: job.jobTag,
    active: job.active,
  };
}

function dbRowToApplication(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notice_period: row.notice_period,
    current_salary: row.current_salary,
    cv_url: row.cv_url,
    job_id: row.job_id,
    at: new Date(row.created_at).getTime(),
    whatsapp_last_sent: row.whatsapp_last_sent_at ? new Date(row.whatsapp_last_sent_at).getTime() : null,
    utm_source: row.utm_source,
    utm_medium: row.utm_medium,
    utm_campaign: row.utm_campaign,
    fbclid: row.fbclid,
    relevanceScore: row.relevance_score ?? null,
    relevanceDetail: row.relevance_detail ?? null,
    capiSent: row.capi_sent ?? false,
    capiSkipReason: row.capi_skip_reason ?? null,
  };
}

function fmtSalary(j) {
  if (!j.salMin && !j.salMax) return "Salary not specified";
  const f = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`);
  return `${f(j.salMin)}–${f(j.salMax)} / ${j.salUnit === "annum" ? "yr" : "mo"}`;
}

function salaryInputToRupees(value, unit) {
  const n = Number(value) || 0;
  return unit === "annum" ? Math.round(n * 100000) : n;
}

function rupeesToSalaryInput(rupees, unit) {
  return unit === "annum" ? (rupees ? rupees / 100000 : "") : rupees || "";
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
function Home({ jobs, applications, onJob, loading, isLtmView }) {
  const [cat, setCat] = useState("All");
  const [pulseCount, setPulseCount] = useState(1284 + applications.length);

  useEffect(() => {
    trackPH("home_viewed", { ltm_view: isLtmView });
  }, [isLtmView]);

  useEffect(() => {
    setPulseCount(1284 + applications.length);
  }, [applications.length]);

  useEffect(() => {
    const t = setInterval(() => setPulseCount((c) => c + (Math.random() > 0.6 ? 1 : 0)), 4000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (!j.active) return false;
      if (isLtmView && j.jobTag !== "ltm") return false;
      if (cat !== "All" && j.category !== cat) return false;
      return true;
    });
  }, [jobs, cat, isLtmView]);

  return (
    <>
      {isLtmView ? (
        <section className="sp-hero" style={{ background: "linear-gradient(135deg, #0A0A0A 0%, #1a2a4a 100%)", color: "#fff", paddingBottom: 60 }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div className="sp-eyebrow" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", borderColor: "rgba(255,255,255,0.2)", marginBottom: 20 }}><span className="dot" /> LONG-TERM OPPORTUNITIES</div>
            <h1 style={{ fontSize: "clamp(40px, 8vw, 72px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 20px", color: "#fff" }}>
              <em style={{ color: "#4ADE80", fontStyle: "normal" }}>LTM</em> is actively hiring.
            </h1>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, maxWidth: 650, marginBottom: 0 }}>
              Pre-register for {jobs.filter((j) => j.active && j.jobTag === "ltm").length} roles, answer quick screening questions, and connect directly with our hiring team. It's straightforward.
            </p>
          </div>
        </section>
      ) : (
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
      )}

      {isLtmView && (
        <section className="sp-companies" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="sp-companies-inner">
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <div className="sp-companies-label" style={{ color: "rgba(255,255,255,0.7)" }}>About LTM</div>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, marginTop: 12, marginBottom: 0 }}>
                <strong style={{ color: "#fff" }}>LTM</strong> (formerly LTIMindtree Limited) is an Indian multinational technology services and digital consulting company. A subsidiary of <strong>Larsen & Toubro</strong>, headquartered in Mumbai, LTM is an AI-centric global technology services company and the Business Creativity partner to the world's largest and most disruptive enterprises.
              </p>
            </div>
          </div>
        </section>
      )}

      {!isLtmView && (
        <section className="sp-companies">
          <div className="sp-companies-inner">
            <div className="sp-companies-label">Hiring now on JobPulse</div>
            <div className="sp-chip-row">
              {TRUSTED_COMPANIES.map((c) => <div key={c} className="sp-chip">{c}</div>)}
            </div>
          </div>
        </section>
      )}

      <section className="sp-listing">
        <div className="sp-listing-hdr">
          <div style={{ flex: 1 }}>
            <div className="sp-listing-title">{filtered.length} job{filtered.length === 1 ? "" : "s"} opening</div>
            {isLtmView && <p style={{ fontSize: 14, color: "var(--slate)", marginTop: 6, marginBottom: 0 }}>Apply now and let's connect.</p>}
          </div>
        </div>
        {!isLtmView && (
          <div className="sp-cat-row">
            {CATEGORIES.map((c) => (
              <button key={c} className={`sp-cat-pill${cat === c ? " active" : ""}`} onClick={() => { setCat(c); trackPH("category_filtered", { category: c }); }}>{c}</button>
            ))}
          </div>
        )}
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
function shareUrl(job, medium) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({
    utm_source: "organic_share",
    utm_medium: medium,
    utm_campaign: job.id,
  });
  return `${origin}/job/${job.id}?${params.toString()}`;
}

function ShareJob({ job }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = shareUrl(job, "copy_link");
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    trackPH("job_shared", { job_id: job.id, job_title: job.title, method: "copy_link" });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnWhatsApp = () => {
    const url = shareUrl(job, "whatsapp");
    const message = `${job.title} at ${job.company} — thought this might be a fit for you: ${url}`;
    trackPH("job_shared", { job_id: job.id, job_title: job.title, method: "whatsapp" });
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="sp-share">
      <span className="sp-share-label">Know someone who'd be a good fit?</span>
      <div className="sp-share-btns">
        <button type="button" className="sp-share-btn" onClick={copyLink}>{copied ? "Link copied ✓" : "Copy link"}</button>
        <button type="button" className="sp-share-btn sp-share-btn-wa" onClick={shareOnWhatsApp}>Share on WhatsApp</button>
      </div>
    </div>
  );
}

function JobDetail({ job, onBack, onSuccess, onStart, screeningQuestions }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", noticePeriod: "", currentSalary: "", cvFile: null });
  const [screening, setScreening] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const startedRef = useRef(false);
  const formRef = useRef(null);

  useEffect(() => {
    trackPH("job_viewed", { job_id: job.id, job_title: job.title, company: job.company, category: job.category });
    const init = {};
    if (screeningQuestions) {
      screeningQuestions.forEach((q) => {
        init[q.id] = "";
      });
    }
    setScreening(init);
  }, [job.id, screeningQuestions]);

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
  const setFile = (e) => setF({ ...f, cvFile: e.target.files?.[0] || null });
  const setScreeningAnswer = (qId) => (e) => setScreening({ ...screening, [qId]: e.target.value });

  const [cvError, setCvError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const phone = f.phone.replace(/\D/g, "");
    const salaryIsNumber = f.currentSalary !== "" && !isNaN(Number(f.currentSalary)) && Number(f.currentSalary) >= 0;
    if (!f.name || !/^[6-9]\d{9}$/.test(phone) || !f.email || !f.noticePeriod || !salaryIsNumber || !f.cvFile) return;

    const mandatoryQuestions = screeningQuestions?.filter((q) => q.is_mandatory) || [];
    for (const q of mandatoryQuestions) {
      if (!screening[q.id] || screening[q.id].trim() === "") {
        alert(`Please answer the required screening question: "${q.question_text}"`);
        return;
      }
    }

    setCvError("");
    setSubmitting(true);
    const eventId = uid();

    const ext = f.cvFile.name.split(".").pop();
    const path = `${uid()}.${ext}`;
    const { error: cvErr } = await supabase.storage.from("resumes").upload(path, f.cvFile);
    if (cvErr) {
      console.error("CV upload failed:", cvErr);
      setCvError("We couldn't upload your CV — please check the file and try again.");
      setSubmitting(false);
      return;
    }
    const cvUrl = supabase.storage.from("resumes").getPublicUrl(path).data.publicUrl;

    trackPH("apply_completed", { job_id: job.id, job_title: job.title, company: job.company, category: job.category, name: f.name, email: f.email, notice_period: f.noticePeriod });
    trackMeta("Lead", { content_name: job.title, content_category: job.category, value: 0, currency: "INR" }, eventId);

    onSuccess({
      name: f.name,
      phone,
      email: f.email,
      noticePeriod: f.noticePeriod,
      currentSalary: f.currentSalary,
      cvUrl,
      job,
      eventId,
      screeningAnswers: screening,
      screeningQuestions: screeningQuestions || [],
    });
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
        <ShareJob job={job} />
      </div>
      {job.desc.length > 0 && (
        <div className="sp-jd-section">
          <h3>Key responsibilities</h3>
          <ul>{job.desc.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}
      {job.mustHave?.length > 0 && (
        <div className="sp-jd-section">
          <h3>Must-have skills</h3>
          <ul>{job.mustHave.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}
      {job.goodToHave?.length > 0 && (
        <div className="sp-jd-section">
          <h3>Good to have</h3>
          <ul>{job.goodToHave.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}
      {job.education?.length > 0 && (
        <div className="sp-jd-section">
          <h3>Education</h3>
          <ul>{job.education.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}
      {job.tags.length > 0 && (
        <div className="sp-jd-section">
          <h3>Good to know</h3>
          <ul>{job.tags.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}

      <div className="sp-form-card" ref={formRef}>
        <h3 style={{ marginTop: 0, fontSize: 19 }}>Complete your application</h3>
        <p style={{ color: "var(--slate)", fontSize: 14, marginBottom: 20 }}>Just the essentials — your details, your CV, and a few thoughts from you. That's all we need.</p>
        <form onSubmit={submit} onFocus={markStarted}>
          <div className="sp-field"><label>Full name</label><input required value={f.name} onChange={set("name")} placeholder="Your full name" /></div>
          <div className="sp-field-row">
            <div className="sp-field">
              <label>Phone number</label>
              <input required value={f.phone} onChange={set("phone")} placeholder="10-digit mobile" pattern="[6-9]\d{9}" title="Enter a valid 10-digit mobile number" />
            </div>
            <div className="sp-field"><label>Email</label><input required type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" /></div>
          </div>
          <div className="sp-field-row">
            <div className="sp-field"><label>Notice period</label>
              <select required value={f.noticePeriod} onChange={set("noticePeriod")}>
                <option value="" disabled>Select notice period</option>
                <option>Immediate</option><option>15 days</option><option>30 days</option><option>60 days</option><option>90+ days</option>
              </select>
            </div>
            <div className="sp-field"><label>Current salary (₹, monthly or annual figure)</label><input required type="number" min="0" step="0.01" inputMode="decimal" value={f.currentSalary} onChange={set("currentSalary")} placeholder="e.g. 18000" /></div>
          </div>
          <div className="sp-field">
            <label>CV / Resume (required)</label>
            <input required type="file" accept=".pdf,.doc,.docx" onChange={(e) => { setFile(e); setCvError(""); }} />
            {cvError && <div style={{ color: "#DC2626", fontSize: 13, marginTop: 6 }}>{cvError}</div>}
          </div>

          {screeningQuestions && screeningQuestions.length > 0 && (
            <>
              <div className="sp-screening-nudge">
                <div className="sp-screening-nudge-icon">⚡</div>
                <div className="sp-screening-nudge-text">
                  <div className="sp-screening-nudge-label">Quick questions to help us match you better</div>
                  <div className="sp-screening-nudge-desc">
                    {screeningQuestions.filter((q) => q.is_mandatory).length > 0
                      ? `${screeningQuestions.filter((q) => q.is_mandatory).length} quick answer${screeningQuestions.filter((q) => q.is_mandatory).length === 1 ? "" : "s"} — takes 30 seconds. This helps the recruiter understand your fit.`
                      : "A few extra details go a long way. Answer to stand out from other applicants."}
                  </div>
                </div>
              </div>

              {screeningQuestions.map((q) => (
                <div key={q.id} className="sp-field">
                  <label>
                    {q.question_text}
                    {q.is_mandatory && <span style={{ color: "var(--danger)" }}> *</span>}
                  </label>
                  <textarea
                    value={screening[q.id] || ""}
                    onChange={setScreeningAnswer(q.id)}
                    placeholder="Be genuine. Short answers work fine."
                    rows={2}
                    required={q.is_mandatory}
                    style={{ resize: "vertical" }}
                  />
                </div>
              ))}
            </>
          )}

          <button className="sp-submit" disabled={submitting}>{submitting ? "Sending your application…" : "Send application"}</button>
          <div className="sp-consent">We'll reach out via phone or WhatsApp first — we respect your time. You're in control of the conversation.</div>
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
      <ShareJob job={data.job} />
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
  const blank = { title: "", company: "", category: CATEGORIES[1], location: "", type: "Full-time", exp: "", salMin: "", salMax: "", salUnit: "month", tags: "", desc: "", mustHave: "", goodToHave: "", education: "", jobTag: "", screeningQuestions: [] };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const addScreeningQuestion = () => {
    setF({ ...f, screeningQuestions: [...f.screeningQuestions, { text: "", mandatory: false }] });
  };

  const updateScreeningQuestion = (idx, field, value) => {
    const updated = [...f.screeningQuestions];
    updated[idx] = { ...updated[idx], [field]: value };
    setF({ ...f, screeningQuestions: updated });
  };

  const removeScreeningQuestion = (idx) => {
    setF({ ...f, screeningQuestions: f.screeningQuestions.filter((_, i) => i !== idx) });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!f.title || !f.company || !f.location) return;
    const job = {
      id: "j" + uid().slice(0, 6),
      title: f.title, company: f.company, category: f.category, location: f.location,
      type: f.type, exp: f.exp || "Not specified",
      salMin: salaryInputToRupees(f.salMin, f.salUnit), salMax: salaryInputToRupees(f.salMax, f.salUnit), salUnit: f.salUnit,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      desc: f.desc.split("\n").map((d) => d.trim()).filter(Boolean),
      mustHave: f.mustHave.split("\n").map((d) => d.trim()).filter(Boolean),
      goodToHave: f.goodToHave.split("\n").map((d) => d.trim()).filter(Boolean),
      education: f.education.split("\n").map((d) => d.trim()).filter(Boolean),
      jobTag: f.jobTag || null,
      screeningQuestions: f.screeningQuestions,
      active: true, postedAt: Date.now(),
    };
    onCreate(job);
    trackPH("admin_job_posted", { job_id: job.id, category: job.category, has_screening: f.screeningQuestions.length > 0 });
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
          <div className="sp-field"><label>Min salary {f.salUnit === "annum" ? "(in Lakhs, e.g. 3 for ₹3L)" : "(₹ per month)"}</label><input type="number" step="0.1" value={f.salMin} onChange={set("salMin")} /></div>
          <div className="sp-field"><label>Max salary {f.salUnit === "annum" ? "(in Lakhs, e.g. 5 for ₹5L)" : "(₹ per month)"}</label><input type="number" step="0.1" value={f.salMax} onChange={set("salMax")} /></div>
        </div>
        <div className="sp-field"><label>Salary unit</label>
          <select value={f.salUnit} onChange={set("salUnit")}><option value="month">Per month</option><option value="annum">Per annum</option></select>
        </div>
        <div className="sp-field"><label>Job tag (e.g. "ltm" for LTM jobs)</label><input value={f.jobTag} onChange={set("jobTag")} placeholder="Optional, e.g. ltm" /></div>
        <div className="sp-field"><label>Tags (comma separated)</label><input value={f.tags} onChange={set("tags")} placeholder="Walk-in interview, Freshers welcome" /></div>
        <div className="sp-field"><label>Key responsibilities (one bullet per line)</label><textarea rows={4} value={f.desc} onChange={set("desc")} /></div>
        <div className="sp-field"><label>Must-have skills (optional, one per line)</label><textarea rows={3} value={f.mustHave} onChange={set("mustHave")} placeholder={"e.g. 3+ years Python\nExperience with LangChain"} /></div>
        <div className="sp-field"><label>Good to have (optional, one per line)</label><textarea rows={3} value={f.goodToHave} onChange={set("goodToHave")} placeholder={"e.g. Exposure to LangGraph\nPrior startup experience"} /></div>
        <div className="sp-field"><label>Education requirement (optional, one per line)</label><textarea rows={2} value={f.education} onChange={set("education")} placeholder={"e.g. Bachelor's in CS or related field"} /></div>

        <div style={{ marginTop: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Screening questions (optional, max 5)</label>
          {f.screeningQuestions.length > 0 && (
            <div className="sp-screening-list">
              {f.screeningQuestions.map((q, idx) => (
                <div key={idx} className="sp-screening-item">
                  <input type="checkbox" className="sp-screening-checkbox" checked={q.mandatory} onChange={(e) => updateScreeningQuestion(idx, "mandatory", e.target.checked)} title="Mark as mandatory" />
                  <input type="text" value={q.text} onChange={(e) => updateScreeningQuestion(idx, "text", e.target.value)} placeholder="Question text…" />
                  <button type="button" className="sp-screening-remove" onClick={() => removeScreeningQuestion(idx)}>Remove</button>
                </div>
              ))}
            </div>
          )}
          {f.screeningQuestions.length < 5 && (
            <button type="button" className="sp-mini-btn" style={{ marginTop: f.screeningQuestions.length > 0 ? 8 : 0 }} onClick={addScreeningQuestion}>+ Add question</button>
          )}
        </div>

        <button className="sp-submit">Post job</button>
      </form>
    </div>
  );
}

function AdminManageJobs({ jobs, onToggle, onUpdate, onWhatsAppSent }) {
  const [editingId, setEditingId] = useState(null);
  const [ef, setEf] = useState(null);
  const [promotingId, setPromotingId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [fileName, setFileName] = useState("");
  const [pasted, setPasted] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0 });

  const startEdit = (job) => {
    setEditingId(job.id);
    setEf({
      title: job.title, company: job.company, category: job.category, location: job.location,
      type: job.type, exp: job.exp, salMin: rupeesToSalaryInput(job.salMin, job.salUnit), salMax: rupeesToSalaryInput(job.salMax, job.salUnit), salUnit: job.salUnit,
      tags: job.tags.join(", "), desc: job.desc.join("\n"),
      mustHave: (job.mustHave || []).join("\n"), goodToHave: (job.goodToHave || []).join("\n"), education: (job.education || []).join("\n"),
      jobTag: job.jobTag || "",
    });
  };
  const cancelEdit = () => { setEditingId(null); setEf(null); };
  const set = (k) => (e) => setEf({ ...ef, [k]: e.target.value });

  const saveEdit = () => {
    if (!ef.title || !ef.company || !ef.location) return;
    onUpdate(editingId, {
      title: ef.title, company: ef.company, category: ef.category, location: ef.location,
      type: ef.type, exp: ef.exp || "Not specified",
      salMin: salaryInputToRupees(ef.salMin, ef.salUnit), salMax: salaryInputToRupees(ef.salMax, ef.salUnit), salUnit: ef.salUnit,
      tags: ef.tags.split(",").map((t) => t.trim()).filter(Boolean),
      desc: ef.desc.split("\n").map((d) => d.trim()).filter(Boolean),
      mustHave: ef.mustHave.split("\n").map((d) => d.trim()).filter(Boolean),
      goodToHave: ef.goodToHave.split("\n").map((d) => d.trim()).filter(Boolean),
      education: ef.education.split("\n").map((d) => d.trim()).filter(Boolean),
      jobTag: ef.jobTag || null,
    });
    cancelEdit();
  };

  const startPromote = (jobId) => { setPromotingId(jobId); setContacts([]); setFileName(""); setPasted(""); setProgress({ sent: 0, failed: 0 }); };
  const cancelPromote = () => { setPromotingId(null); setContacts([]); setFileName(""); setPasted(""); };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    parseContactsCSV(file, (parsed) => { setContacts(parsed); setProgress({ sent: 0, failed: 0 }); });
  };
  const applyPasted = () => {
    setContacts(parseContactsText(pasted));
    setProgress({ sent: 0, failed: 0 });
  };

  const jobLink = (job) => `${typeof window !== "undefined" ? window.location.origin : ""}/job/${job.id}`;

  const sendPromotion = async (job) => {
    if (contacts.length === 0) return;
    setSending(true);
    setProgress({ sent: 0, failed: 0 });
    for (const c of contacts) {
      const ok = await sendWhatsApp({ phone: c.phone, templateId: "job_promotion", params: { name: c.name, job_title: job.title, company: job.company, location: job.location, exp: job.exp || "Not specified", salary: fmtSalary(job), job_id: job.id } });
      setProgress((p) => (ok ? { ...p, sent: p.sent + 1 } : { ...p, failed: p.failed + 1 }));
    }
    onWhatsAppSent(contacts.map((c) => c.phone));
    setSending(false);
  };

  return (
    <div className="sp-card">
      <h3 style={{ marginTop: 0 }}>All jobs ({jobs.length})</h3>
      <table className="sp-table">
        <thead><tr><th>Title</th><th>Company</th><th>Category</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {jobs.map((j) => (
            editingId === j.id ? (
              <tr key={j.id}>
                <td colSpan={5}>
                  <div style={{ padding: "12px 0" }}>
                    <div className="sp-field-row">
                      <div className="sp-field"><label>Job title</label><input value={ef.title} onChange={set("title")} /></div>
                      <div className="sp-field"><label>Company</label><input value={ef.company} onChange={set("company")} /></div>
                    </div>
                    <div className="sp-field-row">
                      <div className="sp-field"><label>Category</label>
                        <select value={ef.category} onChange={set("category")}>{CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}</select>
                      </div>
                      <div className="sp-field"><label>Location</label><input value={ef.location} onChange={set("location")} /></div>
                    </div>
                    <div className="sp-field-row">
                      <div className="sp-field"><label>Job type</label>
                        <select value={ef.type} onChange={set("type")}><option>Full-time</option><option>Part-time</option><option>Contract</option></select>
                      </div>
                      <div className="sp-field"><label>Experience</label><input value={ef.exp} onChange={set("exp")} /></div>
                    </div>
                    <div className="sp-field-row">
                      <div className="sp-field"><label>Min salary {ef.salUnit === "annum" ? "(in Lakhs)" : "(₹ per month)"}</label><input type="number" step="0.1" value={ef.salMin} onChange={set("salMin")} /></div>
                      <div className="sp-field"><label>Max salary {ef.salUnit === "annum" ? "(in Lakhs)" : "(₹ per month)"}</label><input type="number" step="0.1" value={ef.salMax} onChange={set("salMax")} /></div>
                    </div>
                    <div className="sp-field"><label>Salary unit</label>
                      <select value={ef.salUnit} onChange={set("salUnit")}><option value="month">Per month</option><option value="annum">Per annum</option></select>
                    </div>
                    <div className="sp-field"><label>Job tag</label><input value={ef.jobTag} onChange={set("jobTag")} placeholder="e.g. ltm" /></div>
                    <div className="sp-field"><label>Tags (comma separated)</label><input value={ef.tags} onChange={set("tags")} /></div>
                    <div className="sp-field"><label>Key responsibilities (one bullet per line)</label><textarea rows={4} value={ef.desc} onChange={set("desc")} /></div>
                    <div className="sp-field"><label>Must-have skills (optional, one per line)</label><textarea rows={3} value={ef.mustHave} onChange={set("mustHave")} /></div>
                    <div className="sp-field"><label>Good to have (optional, one per line)</label><textarea rows={3} value={ef.goodToHave} onChange={set("goodToHave")} /></div>
                    <div className="sp-field"><label>Education requirement (optional, one per line)</label><textarea rows={2} value={ef.education} onChange={set("education")} /></div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="sp-submit" style={{ width: "auto", padding: "10px 18px", marginTop: 0 }} onClick={saveEdit}>Save changes</button>
                      <button className="sp-mini-btn" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : promotingId === j.id ? (
              <tr key={j.id}>
                <td colSpan={5}>
                  <div style={{ padding: "12px 0" }}>
                    <div className="sp-field">
                      <label>Job link (this is the CTA candidates will tap)</label>
                      <input readOnly value={jobLink(j)} onClick={(e) => e.target.select()} />
                    </div>
                    <div className="sp-wa-preview">"{WHATSAPP_TEMPLATES.find((t) => t.id === "job_promotion").preview("Candidate Name", j.title, j.company, j.location, j.exp || "Not specified", fmtSalary(j))}"</div>
                    <p style={{ color: "var(--slate)", fontSize: 13.5, marginTop: 0 }}>
                      Send to any list — upload a CSV or paste numbers below. Only message people who've agreed to be contacted this way.
                    </p>
                    <div className="sp-field-row">
                      <div className="sp-field">
                        <label>Upload CSV (name + phone columns, auto-detected)</label>
                        <input type="file" accept=".csv" onChange={handleFile} />
                        {fileName && <div style={{ fontSize: 12.5, color: "var(--slate)", marginTop: 6 }}>{contacts.length} contact{contacts.length === 1 ? "" : "s"} loaded from {fileName}</div>}
                      </div>
                      <div className="sp-field">
                        <label>...or paste numbers (one per line: "Name, phone" or just phone)</label>
                        <textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"Priya Sharma, 9876543210\n9123456780"} />
                        <button className="sp-mini-btn" style={{ marginTop: 6 }} onClick={applyPasted} disabled={!pasted.trim()}>Load pasted numbers</button>
                      </div>
                    </div>
                    {contacts.length > 0 && (
                      <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 9, margin: "10px 0 14px" }}>
                        <table className="sp-table">
                          <thead><tr><th>Name</th><th>Phone</th></tr></thead>
                          <tbody>
                            {contacts.map((c, i) => (
                              <tr key={i}>
                                <td>{c.name}</td>
                                <td>{c.phone}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button className="sp-submit" style={{ width: "auto", padding: "10px 18px", marginTop: 0 }} disabled={contacts.length === 0 || sending} onClick={() => sendPromotion(j)}>
                        {sending ? `Sending… (${progress.sent + progress.failed}/${contacts.length})` : `Send to ${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
                      </button>
                      <button className="sp-mini-btn" onClick={cancelPromote}>Cancel</button>
                      {!sending && (progress.sent > 0 || progress.failed > 0) && (
                        <span style={{ fontSize: 13, color: "var(--slate)" }}>Sent: {progress.sent} · Failed: {progress.failed}</span>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={j.id}>
                <td>{j.title}</td><td>{j.company}</td><td>{j.category}</td>
                <td><span className={`sp-badge ${j.active ? "on" : "off"}`}>{j.active ? "Live" : "Paused"}</span></td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="sp-mini-btn" onClick={() => startEdit(j)}>Edit</button>
                  <button className="sp-mini-btn" onClick={() => onToggle(j.id)}>{j.active ? "Pause" : "Activate"}</button>
                  <button className="sp-mini-btn" onClick={() => startPromote(j.id)}>Promote via WhatsApp</button>
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}

function utmBreakdown(list, key, emptyLabel) {
  const counts = new Map();
  for (const a of list) {
    const v = (a[key] || emptyLabel);
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const total = list.length || 1;
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

function RelevanceBadge({ score, detail }) {
  if (score === null || score === undefined) {
    const reason = detail?.reason;
    const label = reason === "resume_text_unavailable" ? "CV unreadable"
      : reason === "job_has_no_scoreable_fields" ? "No JD to match"
      : "Scoring…";
    return <span className="sp-rel-badge none" title="Not yet scored">{label}</span>;
  }
  const tier = score >= 70 ? "high" : score >= 50 ? "mid" : "low";
  const parts = [];
  for (const key of ["must_have", "good_to_have", "education", "tags"]) {
    const cat = detail?.[key];
    if (cat) parts.push(`${key.replace("_", " ")}: ${cat.matched.length}/${cat.matched.length + cat.missed.length}`);
  }
  if (detail?.description_fallback) parts.push("matched against job description");
  return <span className={`sp-rel-badge ${tier}`} title={parts.join(" · ") || "Relevance score"}>{score}</span>;
}

function AdminApplications({ applications, jobs, loading, screeningAnswersMap }) {
  const [jobFilter, setJobFilter] = useState("all");
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const jobTitle = (id) => jobs.find((j) => j.id === id)?.title || id;

  const filtered = jobFilter === "all" ? applications : applications.filter((a) => a.job_id === jobFilter);

  const sorted = useMemo(() => {
    if (sortBy !== "relevance") return filtered;
    return [...filtered].sort((a, b) => {
      if (a.relevanceScore === null && b.relevanceScore === null) return 0;
      if (a.relevanceScore === null) return 1;
      if (b.relevanceScore === null) return -1;
      return sortDir === "desc" ? b.relevanceScore - a.relevanceScore : a.relevanceScore - b.relevanceScore;
    });
  }, [filtered, sortBy, sortDir]);

  const toggleRelevanceSort = () => {
    if (sortBy !== "relevance") { setSortBy("relevance"); setSortDir("desc"); }
    else setSortDir((d) => (d === "desc" ? "asc" : "desc"));
  };

  const countsByJob = useMemo(() => {
    const m = new Map();
    for (const a of applications) m.set(a.job_id, (m.get(a.job_id) || 0) + 1);
    return m;
  }, [applications]);

  const sourceBreakdown = useMemo(() => utmBreakdown(filtered, "utm_source", "direct"), [filtered]);

  const exportCSV = () => {
    const allScreeningQuestions = new Map();
    for (const appId in screeningAnswersMap) {
      const answers = screeningAnswersMap[appId] || [];
      answers.forEach((ans, idx) => {
        if (!allScreeningQuestions.has(idx)) {
          allScreeningQuestions.set(idx, `Q${idx + 1}`);
        }
      });
    }

    const headers = ["Name", "Phone", "Email", "Job", "Notice Period", "Current Salary", "CV Link", "Relevance Score", "Sent to Meta", "Source", "Applied At"];
    for (let i = 0; i < allScreeningQuestions.size; i++) {
      headers.push(`Q${i + 1}`);
    }

    const rows = [
      headers,
      ...sorted.map((a) => {
        const baseRow = [a.name, a.phone, a.email, jobTitle(a.job_id), a.notice_period, a.current_salary, a.cv_url || "—", a.relevanceScore ?? "unscored", a.capiSent ? "yes" : "no", a.utm_source, new Date(a.at).toLocaleString()];
        const answers = screeningAnswersMap[a.id] || [];
        for (let i = 0; i < allScreeningQuestions.size; i++) {
          baseRow.push(answers[i] || "");
        }
        return baseRow;
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "applications.csv"; a.click();
  };

  return (
    <div>
      <div className="sp-card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>
          Traffic source breakdown {jobFilter !== "all" ? `— ${jobTitle(jobFilter)}` : "— all jobs"} ({filtered.length})
        </h3>
        {filtered.length === 0 ? (
          <p style={{ color: "var(--slate)" }}>No applications to break down yet.</p>
        ) : (
          <div style={{ maxWidth: 420 }}>
            {sourceBreakdown.map((r) => (
              <div className="sp-utm-row" key={r.value}>
                <div className="sp-utm-row-top">
                  <span className="sp-utm-row-label">{r.value}</span>
                  <span className="sp-utm-row-count">{r.count} · {r.pct}%</span>
                </div>
                <div className="sp-utm-bar-track"><div className="sp-utm-bar-fill" style={{ width: `${r.pct}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sp-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ marginTop: 0 }}>
            Applications ({filtered.length}{jobFilter !== "all" ? ` of ${applications.length}` : ""})
          </h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
              <option value="all">All jobs ({applications.length})</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title} ({countsByJob.get(j.id) || 0})</option>
              ))}
            </select>
            <button className="sp-mini-btn" onClick={exportCSV}>Export CSV</button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--slate)" }}>Loading applications…</p>
        ) : applications.length === 0 ? (
          <p style={{ color: "var(--slate)" }}>No applications yet.</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "var(--slate)" }}>No applications for this job yet.</p>
        ) : (
          <table className="sp-table">
            <thead>
              <tr>
                <th>Name</th><th>Phone</th><th>Job</th><th>Notice</th><th>Salary</th><th>CV</th>
                <th className="sp-th-sort" onClick={toggleRelevanceSort}>
                  Relevance{sortBy === "relevance" ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                </th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, i) => (
                <tr key={i}>
                  <td>{a.name}</td>
                  <td>{a.phone}</td>
                  <td>{jobTitle(a.job_id)}</td>
                  <td>{a.notice_period || "—"}</td>
                  <td>{a.current_salary || "—"}</td>
                  <td>{a.cv_url ? <a href={a.cv_url} target="_blank" rel="noopener noreferrer">View CV</a> : "—"}</td>
                  <td><RelevanceBadge score={a.relevanceScore} detail={a.relevanceDetail} /></td>
                  <td>{a.utm_source || "direct"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminAnalytics({ jobs, applications, funnel }) {
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

function AdminCampaign({ jobs }) {
  const [contacts, setContacts] = useState([]);
  const [fileName, setFileName] = useState("");
  const [templateId, setTemplateId] = useState(WHATSAPP_TEMPLATES[0].id);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0 });

  const template = WHATSAPP_TEMPLATES.find((t) => t.id === templateId);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = (results.data || [])
          .map((row) => {
            const keys = Object.keys(row);
            const nameKey = keys.find((k) => k.toLowerCase().includes("name"));
            const phoneKey = keys.find((k) => /phone|mobile|number/.test(k.toLowerCase()));
            return {
              name: (nameKey ? row[nameKey] : "")?.toString().trim() || "Candidate",
              phone: (phoneKey ? row[phoneKey] : "")?.toString().trim() || "",
            };
          })
          .filter((c) => c.phone);
        setContacts(parsed);
        setProgress({ sent: 0, failed: 0 });
      },
    });
  };

  const useJob = (id) => {
    setSelectedJobId(id);
    const j = jobs.find((j) => j.id === id);
    if (j) {
      setJobTitle(j.title);
      setLink(`${typeof window !== "undefined" ? window.location.origin : ""}/job/${j.id}`);
    }
  };

  const sendCampaign = async () => {
    if (contacts.length === 0) return;
    setSending(true);
    setProgress({ sent: 0, failed: 0 });
    for (const c of contacts) {
      const ok = await sendWhatsApp({ phone: c.phone, templateId, params: { name: c.name, job_title: jobTitle, link } });
      setProgress((p) => (ok ? { ...p, sent: p.sent + 1 } : { ...p, failed: p.failed + 1 }));
    }
    setSending(false);
  };

  return (
    <div className="sp-card">
      <h3 style={{ marginTop: 0 }}>WhatsApp campaign — upload your own list</h3>
      <p style={{ color: "var(--slate)", fontSize: 13.5 }}>
        Upload a CSV with a name column and a phone column. Only upload contacts who've agreed to be reached this way.
      </p>
      <div className="sp-field">
        <label>CSV file</label>
        <input type="file" accept=".csv" onChange={handleFile} />
        {fileName && <div style={{ fontSize: 12.5, color: "var(--slate)", marginTop: 6 }}>{contacts.length} contact{contacts.length === 1 ? "" : "s"} loaded from {fileName}</div>}
      </div>
      <div className="sp-field-row">
        <div className="sp-field"><label>Template</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {WHATSAPP_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div className="sp-field"><label>Use an existing job (optional)</label>
          <select value={selectedJobId} onChange={(e) => useJob(e.target.value)}>
            <option value="">— Manual entry —</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </div>
      </div>
      <div className="sp-field-row">
        <div className="sp-field"><label>Job title (used in message)</label><input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
        <div className="sp-field"><label>Link (used in message)</label><input value={link} onChange={(e) => setLink(e.target.value)} /></div>
      </div>
      <div className="sp-wa-preview">"{template.preview(contacts[0]?.name || "Candidate Name", jobTitle || "Job Title", link || "[link]")}"</div>
      <button className="sp-submit" style={{ width: "auto", padding: "10px 18px" }} disabled={contacts.length === 0 || sending} onClick={sendCampaign}>
        {sending ? `Sending… (${progress.sent + progress.failed}/${contacts.length})` : `Send campaign to ${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
      </button>
      {!sending && (progress.sent > 0 || progress.failed > 0) && (
        <p style={{ marginTop: 10, fontSize: 13.5, color: "var(--slate)" }}>Sent: {progress.sent} · Failed: {progress.failed}</p>
      )}
    </div>
  );
}

function AdminShell({ jobs, applications, funnel, onCreate, onToggle, onUpdate, onWhatsAppSent, onExit, loadingApps, screeningAnswersMap }) {
  const [tab, setTab] = useState("post");
  return (
    <div className="sp-adm-shell">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Admin dashboard</h2>
        <button className="sp-admin-link" onClick={onExit}>Exit to candidate view</button>
      </div>
      <div className="sp-adm-tabs">
        {[["post", "Post a job"], ["manage", "Manage jobs"], ["apps", "Applications"], ["campaign", "WhatsApp Campaign"], ["analytics", "Analytics"]].map(([k, l]) => (
          <button key={k} className={`sp-adm-tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "post" && <AdminPostJob onCreate={onCreate} />}
      {tab === "manage" && <AdminManageJobs jobs={jobs} onToggle={onToggle} onUpdate={onUpdate} onWhatsAppSent={onWhatsAppSent} />}
      {tab === "apps" && <AdminApplications applications={applications} jobs={jobs} loading={loadingApps} screeningAnswersMap={screeningAnswersMap} />}
      {tab === "campaign" && <AdminCampaign jobs={jobs} />}
      {tab === "analytics" && <AdminAnalytics jobs={jobs} applications={applications} funnel={funnel} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ROOT APP
   ════════════════════════════════════════════════════════════════════════ */
export default function App() {
  useState(() => { captureUTM(); return null; });

  const [db, setDb] = useState({ jobs: [], applications: [] });
  const [screeningQuestionsMap, setScreeningQuestionsMap] = useState({});
  const [screeningAnswersMap, setScreeningAnswersMap] = useState({});
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [view, setView] = useState(() =>
    typeof window !== "undefined" && window.location.pathname.replace(/\/$/, "").endsWith("/admin") ? "admin" : "candidate"
  );
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [page, setPage] = useState("home");
  const [selJob, setSelJob] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [funnel, setFunnel] = useState({ job_viewed: 0, apply_started: 0 });
  const [isLtmView, setIsLtmView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname.includes("/jobs/ltm");
  });

  const [pendingJobId] = useState(() => {
    if (typeof window === "undefined") return null;
    const m = window.location.pathname.match(/\/job\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  });

  useEffect(() => {
    if (pendingJobId && db.jobs.length > 0 && page === "home") {
      const j = db.jobs.find((j) => j.id === pendingJobId);
      if (j) { setSelJob(j); setPage("jd"); }
    }
  }, [pendingJobId, db.jobs]);

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

  // Load screening questions
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("screening_questions")
        .select("*")
        .order("question_order", { ascending: true });

      if (error) {
        console.error("Failed to load screening questions:", error);
      } else if (data) {
        const grouped = {};
        for (const q of data) {
          if (!grouped[q.job_id]) {
            grouped[q.job_id] = [];
          }
          grouped[q.job_id].push(q);
        }
        setScreeningQuestionsMap(grouped);
      }
    })();
  }, []);

  const [loadingApps, setLoadingApps] = useState(false);
  useEffect(() => {
    if (!adminAuthed) return;
    (async () => {
      setLoadingApps(true);
      try {
        const resp = await fetch(ADMIN_DATA_ENDPOINT, {
          method: "POST",
          headers: EDGE_FN_HEADERS,
          body: JSON.stringify({ password: ADMIN_PASSWORD }),
        });
        if (resp.ok) {
          const { applications, screeningAnswersMap } = await resp.json();
          setDb((d) => ({ ...d, applications: (applications || []).map(dbRowToApplication) }));
          setScreeningAnswersMap(screeningAnswersMap || {});
        } else {
          console.error("Failed to load applications:", await resp.text());
        }
      } catch (e) {
        console.error("Failed to load applications:", e);
      }
      setLoadingApps(false);
    })();
  }, [adminAuthed]);

  const bump = (key) => setFunnel((f) => ({ ...f, [key]: (f[key] || 0) + 1 }));

  const goHome = () => {
    setView("candidate"); setPage("home"); setSelJob(null);
    if (typeof window !== "undefined") {
      const path = isLtmView ? "/jobs/ltm" : "/";
      window.history.pushState({}, "", path);
    }
  };

  const openJob = (j) => {
    setSelJob(j); setPage("jd"); bump("job_viewed"); window.scrollTo(0, 0);
    if (typeof window !== "undefined") window.history.pushState({}, "", `/job/${j.id}`);
  };

  useEffect(() => {
    const onPopState = () => {
      const m = window.location.pathname.match(/\/job\/([^/]+)/);
      if (m) {
        const j = db.jobs.find((j) => j.id === decodeURIComponent(m[1]));
        if (j) { setSelJob(j); setPage("jd"); return; }
      }
      if (window.location.pathname.includes("/jobs/ltm")) {
        setIsLtmView(true);
        setPage("home");
      } else {
        setPage("home"); setSelJob(null);
        setIsLtmView(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [db.jobs]);

  const finishApply = async (data) => {
    const utm = getUTM();
    const record = {
      id: uid(),
      name: data.name, phone: data.phone, email: data.email,
      notice_period: data.noticePeriod, current_salary: data.currentSalary,
      cv_url: data.cvUrl, job_id: data.job.id, at: Date.now(),
      whatsapp_last_sent: null,
      ...utm,
    };
    setDb((d) => ({ ...d, applications: [...d.applications, record] }));
    setSuccessData(data);
    setPage("success");
    window.scrollTo(0, 0);

    const { data: appData, error } = await supabase.from("applications").insert({
      job_id: data.job.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      notice_period: data.noticePeriod,
      current_salary: data.currentSalary,
      cv_url: data.cvUrl,
      event_id: data.eventId,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      fbclid: utm.fbclid,
    }).select().single();

    if (error) {
      console.error("Failed to save application to Supabase:", error);
      return;
    }

    if (data.screeningAnswers && Object.keys(data.screeningAnswers).length > 0) {
      const answersToSave = Object.entries(data.screeningAnswers).map(([qId, answer]) => ({
        application_id: appData.id,
        question_id: qId,
        answer_text: answer,
      }));

      const { error: ansError } = await supabase.from("screening_answers").insert(answersToSave);
      if (ansError) {
        console.error("Failed to save screening answers:", ansError);
      }
    }
  };

  const createJob = async (job) => {
    const tempId = job.id;
    setDb((d) => ({ ...d, jobs: [job, ...d.jobs] }));

    const { data, error } = await supabase.from("jobs").insert(jobToDbRow(job)).select().single();
    if (error) {
      console.error("Failed to save job to Supabase:", error);
      setDb((d) => ({ ...d, jobs: d.jobs.filter((j) => j.id !== tempId) }));
    } else {
      const newJob = dbRowToJob(data);
      setDb((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === tempId ? newJob : j)) }));

      if (job.screeningQuestions && job.screeningQuestions.length > 0) {
        const questionsToSave = job.screeningQuestions.map((q, idx) => ({
          job_id: data.id,
          question_text: q.text,
          is_mandatory: q.mandatory,
          question_order: idx + 1,
        }));

        const { error: qError } = await supabase.from("screening_questions").insert(questionsToSave);
        if (qError) {
          console.error("Failed to save screening questions:", qError);
        }
      }
    }
  };

  const toggleJob = async (id) => {
    const job = db.jobs.find((j) => j.id === id);
    if (!job) return;
    setDb((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? { ...j, active: !j.active } : j)) }));
    const { error } = await supabase.from("jobs").update({ active: !job.active }).eq("id", id);
    if (error) {
      console.error("Failed to update job in Supabase:", error);
      setDb((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? { ...j, active: job.active } : j)) }));
    }
  };

  const updateJob = async (id, updates) => {
    const prevJob = db.jobs.find((j) => j.id === id);
    if (!prevJob) return;
    const merged = { ...prevJob, ...updates };
    setDb((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? merged : j)) }));

    const { error } = await supabase.from("jobs").update({
      title: merged.title, company: merged.company, category: merged.category, location: merged.location,
      job_type: merged.type, experience: merged.exp, salary_min: merged.salMin, salary_max: merged.salMax,
      salary_unit: merged.salUnit, tags: merged.tags, description: merged.desc,
      must_have: merged.mustHave, good_to_have: merged.goodToHave, education: merged.education,
      job_tag: merged.jobTag,
    }).eq("id", id);
    if (error) {
      console.error("Failed to save job edits to Supabase:", error);
      setDb((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? prevJob : j)) }));
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
          {page === "home" && <Home jobs={db.jobs} applications={db.applications} onJob={openJob} loading={loadingJobs} isLtmView={isLtmView} />}
          {page === "jd" && selJob && <JobDetail job={selJob} onBack={goHome} onSuccess={finishApply} onStart={() => bump("apply_started")} screeningQuestions={screeningQuestionsMap[selJob.id]} />}
          {page === "success" && successData && <Success data={successData} onHome={goHome} />}
        </>
      )}

      {view === "admin" && (
        adminAuthed
          ? <AdminShell jobs={db.jobs} applications={db.applications} funnel={funnel} onCreate={createJob} onToggle={toggleJob} onUpdate={updateJob} onWhatsAppSent={markWhatsAppSent} onExit={goHome} loadingApps={loadingApps} screeningAnswersMap={screeningAnswersMap} />
          : <AdminGate onIn={() => setAdminAuthed(true)} />
      )}

    </div>
  );
}
