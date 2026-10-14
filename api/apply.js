// POST /api/apply -> saves one application (candidate + CV + application + screening answers)
import { db, json } from './_db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTICE_DAYS = { 'Immediate': 0, '15 days': 15, '30 days': 30, '60 days': 60, '90+ days': 90 };
const LETTER_KEY = { A: 'opt_0', B: 'opt_1', C: 'opt_2', D: 'opt_3' };
const MIME = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const str = (v, n = 300) => (v == null ? null : String(v).slice(0, n));

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const b = req.body || {};
  const phone = String(b.phone || '').replace(/\D/g, '').slice(-10);
  const email = str(b.email, 200);
  const name = str(b.name, 200);

  if (!UUID.test(String(b.job_id || ''))) return json(res, 400, { error: 'bad_job' });
  if (!name || !/^[6-9]\d{9}$/.test(phone) || !email || !/^\S+@\S+\.\S+$/.test(email))
    return json(res, 400, { error: 'bad_contact' });
  if (!(b.notice_period in NOTICE_DAYS)) return json(res, 400, { error: 'bad_notice' });
  const salary = Number(b.current_salary);
  if (!Number.isFinite(salary) || salary < 0) return json(res, 400, { error: 'bad_salary' });
  const cvUrl = String(b.cv_url || '');
  if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/resumes\//i.test(cvUrl))
    return json(res, 400, { error: 'bad_cv' });
  const fileName = str(b.cv_file_name, 200) || 'cv';
  const ext = fileName.split('.').pop().toLowerCase();
  const eventId = UUID.test(String(b.event_id || '')) ? b.event_id : null;

  const c = await db().connect();
  try {
    await c.query('BEGIN');

    const job = await c.query("select id from jobs where id = $1 and status = 'active'", [b.job_id]);
    if (!job.rows.length) { await c.query('ROLLBACK'); return json(res, 404, { error: 'job_closed' }); }

    // One person per phone number. phone_verified_at stays NULL: the live form does not verify OTP.
    const cand = await c.query(
      `insert into candidates (phone, name, email) values ($1, $2, $3)
       on conflict (phone) do update set name = excluded.name, email = excluded.email
       returning id`, [phone, name, email]);
    const candidateId = cand.rows[0].id;

    // Same person already applied to this job: keep the first application, do not overwrite.
    const dup = await c.query('select id from applications where candidate_id = $1 and job_id = $2', [candidateId, b.job_id]);
    if (dup.rows.length) { await c.query('ROLLBACK'); return json(res, 200, { ok: true, application_id: dup.rows[0].id, duplicate: true }); }

    const cv = await c.query(
      `insert into candidate_cvs (candidate_id, version, blob_url, file_name, mime_type, size_bytes)
       values ($1, coalesce((select max(version) from candidate_cvs where candidate_id = $1), 0) + 1, $2, $3, $4, $5)
       returning id`,
      [candidateId, cvUrl, fileName, MIME[ext] || 'application/pdf', Number(b.cv_size) || null]);

    const app = await c.query(
      `insert into applications
         (candidate_id, job_id, cv_id, notice_period_days, current_ctc, event_id,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, fbc, fbp)
       values ($1,$2,$3,$4,$5, coalesce($6::uuid, gen_random_uuid()), $7,$8,$9,$10,$11,$12,$13,$14)
       returning id`,
      [candidateId, b.job_id, cv.rows[0].id, NOTICE_DAYS[b.notice_period], salary, eventId,
       str(b.utm_source), str(b.utm_medium), str(b.utm_campaign), str(b.utm_term), str(b.utm_content),
       str(b.fbclid, 500), str(b.fbc, 500), str(b.fbp, 500)]);
    const appId = app.rows[0].id;

    await c.query(
      `insert into application_status_history (application_id, from_status, to_status, changed_by_type)
       values ($1, null, 'submitted', 'candidate')`, [appId]);

    const answers = b.answers && typeof b.answers === 'object' ? b.answers : {};
    for (const [qid, letter] of Object.entries(answers)) {
      if (!UUID.test(qid) || !LETTER_KEY[letter]) continue;
      // Only accept answers for questions that really belong to this job.
      await c.query(
        `insert into screening_answers (application_id, screening_question_id, answer_keys)
         select $1, q.id, $3::jsonb from screening_questions q where q.id = $2 and q.job_id = $4
         on conflict do nothing`,
        [appId, qid, JSON.stringify([LETTER_KEY[letter]]), b.job_id]);
    }

    await c.query('COMMIT');
    json(res, 200, { ok: true, application_id: appId });
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('api/apply', e);
    json(res, 500, { error: 'server_error' });
  } finally {
    c.release();
  }
}
