// Shared helpers for the /api functions. Files starting with "_" are not routes.
import { Pool } from '@neondatabase/serverless';

let pool;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));
}

export function json(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.send(JSON.stringify(body));
}

// jobs.ui holds the display fields the React app already understands
// (category, job_type, experience, salary_*, tags, description, ...).
// This rebuilds the exact row shape the app's dbRowToJob() expects.
export function jobRow(r) {
  return { ...(r.ui || {}), id: r.id, active: r.status === 'active', created_at: r.created_at };
}

export const LIGHT_FIELDS = [
  'id', 'title', 'company', 'category', 'location', 'job_type', 'experience',
  'salary_min', 'salary_max', 'salary_unit', 'tags', 'job_tag', 'active', 'created_at',
];
export function lightJob(row) {
  const o = {};
  for (const k of LIGHT_FIELDS) o[k] = row[k];
  return o;
}

// Neon stores options as [{key,label}]; the app wants a plain array of labels.
export function questionRow(q) {
  return {
    id: q.id,
    job_id: q.job_id,
    question_text: q.question_text,
    options: (q.options || []).map((o) => o.label),
    is_mandatory: q.is_required,
    question_order: q.sort_order,
  };
}
