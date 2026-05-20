import { google } from 'googleapis';
import { createReadStream } from 'node:fs';
import path from 'node:path';

/**
 * Upload a file to a Google Drive folder using a service account, set it
 * publicly readable, and return a direct-download URL that Meta/TikTok can
 * fetch from when posting.
 *
 * Setup (one-off):
 *  1. Create a Google Cloud service account, enable the Drive API.
 *  2. Create a Drive folder, share it with the service account's email
 *     (Editor). Uploaded files live in *your* Drive, in that folder.
 *  3. Provide GOOGLE_SERVICE_ACCOUNT (the full JSON key, as a string) and
 *     DRIVE_FOLDER_ID (the folder's id from its URL).
 */
export function driveConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT && process.env.DRIVE_FOLDER_ID);
}

/**
 * Upload + make publicly readable. Returns `{ id, name, downloadUrl }`.
 * `downloadUrl` is the direct-stream URL — what Meta's media-create
 * (`video_url`) and TikTok's PULL_FROM_URL flow want.
 */
export async function uploadAndShare(filePath, mimeType = 'video/mp4') {
  const folderId = process.env.DRIVE_FOLDER_ID;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!folderId || !raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT and DRIVE_FOLDER_ID must be set');
  }

  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const created = await drive.files.create({
    requestBody: { name: path.basename(filePath), parents: [folderId] },
    media: { mimeType, body: createReadStream(filePath) },
    fields: 'id,name',
  });
  const id = created.data.id;
  const name = created.data.name;
  if (!id) throw new Error('Drive upload returned no file id');

  // "Anyone with the link can view" — required so Meta + TikTok can fetch
  // the file when posting. Files stay in the user's Drive folder, just
  // become unlisted-public for direct access by URL.
  await drive.permissions.create({
    fileId: id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  // Direct file stream — bypasses Drive's HTML preview. Works for files
  // under 100MB without the virus-scan confirmation interstitial.
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
  return { id, name, downloadUrl };
}

/** Delete a Drive file by id — used to keep the storage folder tidy. */
export async function deleteFromDrive(fileId) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) return;
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId });
}
