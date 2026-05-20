import { google } from 'googleapis';
import { createReadStream } from 'node:fs';
import path from 'node:path';

/**
 * Drive uploads. Two modes:
 *  - private (default): file lives in your folder, only you can see it.
 *    Used for thumbnails, caption sidecar, and for video when no social
 *    posting destination needs to fetch it.
 *  - shared: also sets "anyone with link can view" + returns a direct-
 *    stream URL. Meta + TikTok need this to fetch the video when posting.
 *
 * Setup (one-off):
 *  1. Google Cloud → create service account → enable Drive API.
 *  2. Create a Drive folder, share it with the service account (Editor).
 *  3. Provide GOOGLE_SERVICE_ACCOUNT (full JSON, one line) + DRIVE_FOLDER_ID.
 */
export function driveConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT && process.env.DRIVE_FOLDER_ID);
}

function client() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT is not set');
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

/**
 * Upload a file to the configured Drive folder.
 *
 * @returns {Promise<{ id: string, name: string, downloadUrl: string | null }>}
 *   `downloadUrl` is non-null only when `share: true` — it's the direct-stream
 *   URL Meta + TikTok fetch from. Files under 100MB stream cleanly through
 *   this URL; over 100MB Drive shows a virus-scan interstitial.
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
  if (!process.env.GOOGLE_SERVICE_ACCOUNT) return;
  await client().files.delete({ fileId });
}
