-- ════════════════════════════════════════════════════════════════════════
-- JobPulse jobs POC — Supabase schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- Jobs posted by admin
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  category text not null,
  location text not null,
  job_type text not null default 'Full-time',
  experience text,
  salary_min integer,
  salary_max integer,
  salary_unit text default 'month', -- 'month' or 'annum'
  tags text[] default '{}',
  description text[] default '{}',
  active boolean default true,
  created_at timestamptz default now()
);

-- Candidate applications (the row insert that should trigger the
-- server-side Meta Conversions API call — see the webhook note below)
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete set null,
  name text not null,
  phone text not null,
  email text not null,
  notice_period text,
  current_salary text,
  cv_url text, -- path in Supabase Storage bucket, set after upload (see setup-guide.md)
  utm_source text,
  utm_medium text,
  utm_campaign text,
  fbclid text,
  event_id text, -- shared with the browser Meta Pixel call for CAPI dedup
  capi_sent boolean default false,
  whatsapp_last_sent_at timestamptz,
  whatsapp_last_template text,
  created_at timestamptz default now()
);

create index if not exists idx_applications_job_id on applications(job_id);
create index if not exists idx_applications_created_at on applications(created_at);

-- Row Level Security: lock down direct table access; the frontend should
-- go through a Supabase Edge Function or RPC with the service role key
-- for writes, not the anon key directly, once this leaves POC stage.
alter table jobs enable row level security;
alter table applications enable row level security;

create policy "public can read active jobs" on jobs
  for select using (active = true);

-- No public insert/update policy on applications: writes should go
-- through an Edge Function (server-side) so phone/email never round-trip
-- through a client-exposed anon key policy for a PII table.

-- ════════════════════════════════════════════════════════════════════════
-- WIRING THE META CONVERSIONS API TRIGGER
-- Recommended approach: Supabase Database Webhooks (Dashboard → Database
-- → Webhooks → Create a new hook)
--   Table: applications
--   Events: INSERT
--   Type: HTTP Request → POST to your deployed edge function URL
--          https://<project-ref>.functions.supabase.co/meta-capi-on-apply
-- This fires meta-capi-on-apply/index.ts (see that file) automatically
-- whenever a new application row is inserted, without any client code
-- needing to know about it directly.
-- ════════════════════════════════════════════════════════════════════════
