import { google } from 'googleapis';
import { createReadStream } from 'node:fs';
import path from 'node:path';

/**
 * Drive uploads under your personal Google account, authorized via OAuth.
 *
 * Why OAuth (not service account): service accounts have zero storage
 * quota on personal Google accounts, so they can't own uploaded files.
 * Auth-as-user-via-refresh-token uses your 15GB free quota.
 *
 * Setup (one-off, ~5 min):
 *  1. Google Cloud → OAuth 2.0 Client (Desktop type) → note client id + secret
 *  2. OAuth consent screen → add your email as a Test User (External, Testing)
 *  3. Run: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/get-drive-token.mjs
 *  4. Paste the printed refresh token as GOOGLE_REFRESH_TOKEN
 *  5. DRIVE_FOLDER_ID = the folder id you want clips uploaded to
 *
 * Two upload modes:
 *  - private (default): file lives in your folder, only you can see it.
 *  - shared: also sets "anyone with link can view" + returns a direct-stream
 *    URL. Meta + TikTok need this when posting.
 */
export function driveConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.DRIVE_FOLDER_ID,
  );
}

function client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN must all be set');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth: oauth2 });
}

/**
 * Upload a file to the configured Drive folder.
 *
 * @returns {Promise<{ id: string, name: string, downloadUrl: string | null }>}
 *   `downloadUrl` is non-null only when `share: true` — it's the direct-stream
 *   URL Meta + TikTok fetch from.
 */
export async function uploadFile(filePath, mimeType, { share = false } = {}) {
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('DRIVE_FOLDER_ID is not set');

  const drive = client();
  const created = await drive.files.create({
    requestBody: { name: path.basename(filePath), parents: [folderId] },
    media: { mimeType, body: createReadStream(filePath) },
    fields: 'id,name',
  });
  const id = created.data.id;
  const name = created.data.name;
  if (!id) throw new Error('Drive upload returned no file id');

  if (!share) {
    return { id, name, downloadUrl: null };
  }

  await drive.permissions.create({
    fileId: id,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  return {
    id,
    name,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
  };
}

/** Delete a Drive file by id — used to keep the storage folder tidy. */
export async function deleteFromDrive(fileId) {
  if (!driveConfigured()) return;
  await client().files.delete({ fileId });
}
