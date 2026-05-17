import { google } from 'googleapis';
import { createReadStream } from 'node:fs';
import path from 'node:path';

/**
 * Upload a file to a Google Drive folder using a service account.
 *
 * Setup (one-off):
 *  1. Create a Google Cloud service account, enable the Drive API.
 *  2. Create a Drive folder, share it with the service account's email
 *     (Editor). Uploaded files then live in *your* Drive, in that folder.
 *  3. Provide GOOGLE_SERVICE_ACCOUNT (the full JSON key, as a string) and
 *     DRIVE_FOLDER_ID (the folder's id from its URL).
 */
export function driveConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT && process.env.DRIVE_FOLDER_ID);
}

export async function uploadToDrive(filePath) {
  const folderId = process.env.DRIVE_FOLDER_ID;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!folderId || !raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT and DRIVE_FOLDER_ID must be set');
  }

  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.create({
    requestBody: { name: path.basename(filePath), parents: [folderId] },
    media: { mimeType: 'video/mp4', body: createReadStream(filePath) },
    fields: 'id,name,webViewLink',
  });
  return res.data;
}
