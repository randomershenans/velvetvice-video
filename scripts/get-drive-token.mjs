import http from 'node:http';
import { google } from 'googleapis';
import { exec } from 'node:child_process';

/**
 * One-off helper to generate a Google OAuth refresh token for the pipeline.
 *
 * Run with your Desktop-type OAuth client's id and secret in env:
 *
 *   GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." node scripts/get-drive-token.mjs
 *
 * The script:
 *  1. Spins up a tiny local HTTP server on port 3000.
 *  2. Opens your browser to Google's consent page.
 *  3. You click "Allow"; Google redirects back to localhost:3000/oauth/callback.
 *  4. The script exchanges the code for tokens and prints the refresh token.
 *
 * Paste the printed token into GitHub Actions as GOOGLE_REFRESH_TOKEN.
 */

// Override with OAUTH_PORT if 8888 is also in use locally.
const PORT = Number(process.env.OAUTH_PORT ?? 8888);
const REDIRECT_URI = `http://localhost:${PORT}/oauth/callback`;
const SCOPES = ['https://www.googleapis.com/auth/drive'];

function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your env, then re-run.');
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces a fresh refresh_token even on re-auth
    scope: SCOPES,
  });

  console.log('\nOpening browser to authorize. If it does not open, paste this URL:');
  console.log(`\n  ${authUrl}\n`);
  openBrowser(authUrl);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404);
        res.end();
        return;
      }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (error) {
        res.end(`Auth failed: ${error}. You can close this tab.`);
        server.close();
        reject(new Error(`Auth failed: ${error}`));
        return;
      }
      if (code) {
        res.end('Authorized. You can close this tab and return to the terminal.');
        server.close();
        resolve(code);
      }
    });
    server.listen(PORT, () => {
      console.log(`Waiting for the callback on ${REDIRECT_URI} ...`);
    });
  });

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      '\nNo refresh_token returned — Google only returns one on first consent.',
    );
    console.error(
      'Revoke access at https://myaccount.google.com/permissions, then re-run this script.',
    );
    process.exit(1);
  }

  console.log('\n--- Done ---\n');
  console.log('Add this as a GitHub Actions secret named GOOGLE_REFRESH_TOKEN:\n');
  console.log(tokens.refresh_token);
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
