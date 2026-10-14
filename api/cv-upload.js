// POST /api/cv-upload -> issues a short-lived Vercel Blob client-upload token so the
// browser uploads the CV straight to Blob (no 4.5 MB serverless body limit).
import { handleUpload } from '@vercel/blob/client';
import { json } from './_db.js';

const ALLOWED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const out = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^resumes\/[A-Za-z0-9._-]+$/.test(pathname)) throw new Error('bad path');
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: 8 * 1024 * 1024,
          addRandomSuffix: true, // never overwrite an existing CV
        };
      },
      onUploadCompleted: async () => {},
    });
    json(res, 200, out);
  } catch (e) {
    console.error('api/cv-upload', e);
    json(res, 400, { error: 'upload_not_allowed' });
  }
}
