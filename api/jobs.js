// GET /api/jobs -> light list of ACTIVE jobs (replaces the Supabase jobs list query)
import { db, json, jobRow, lightJob } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const { rows } = await db().query(
      "select id, ui, status, created_at from jobs where status = 'active' and ui is not null order by created_at desc"
    );
    res.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=120');
    res.status(200).setHeader('content-type', 'application/json');
    res.send(JSON.stringify(rows.map((r) => lightJob(jobRow(r)))));
  } catch (e) {
    console.error('api/jobs', e);
    json(res, 500, { error: 'server_error' });
  }
}
