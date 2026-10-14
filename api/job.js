// GET /api/job?id=<uuid> -> full job row + its screening questions
import { db, json, jobRow, questionRow } from './_db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  const id = String(req.query.id || '');
  if (!UUID.test(id)) return json(res, 400, { error: 'bad_id' });
  try {
    const j = await db().query('select id, ui, status, created_at from jobs where id = $1 and ui is not null', [id]);
    if (!j.rows.length) return json(res, 404, { error: 'not_found' });
    const q = await db().query(
      'select id, job_id, question_text, options, is_required, sort_order from screening_questions where job_id = $1 order by sort_order',
      [id]
    );
    json(res, 200, { job: jobRow(j.rows[0]), questions: q.rows.map(questionRow) });
  } catch (e) {
    console.error('api/job', e);
    json(res, 500, { error: 'server_error' });
  }
}
