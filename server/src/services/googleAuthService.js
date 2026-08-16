const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SINGLE_USER_ID = 'default_user';
const TOKEN_FILE_PATH = path.join(__dirname, '../../data/gbrain/tokens.json');

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly'
];

function readTokenData() {
  if (!fs.existsSync(TOKEN_FILE_PATH)) return null;
  try {
    const raw = fs.readFileSync(TOKEN_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writeTokenData(data) {
  const dir = path.dirname(TOKEN_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getRedirectUri(req) {
  const envUri = (process.env.GOOGLE_REDIRECT_URI || '').trim();
  if (envUri && envUri.startsWith('http') && !envUri.includes('localhost')) {
    return envUri;
  }
  if (req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers.host;
    return `${protocol}://${host}/api/auth/google/callback`;
  }
  return envUri || 'http://localhost:5000/api/auth/google/callback';
}

/**
 * Creates a raw OAuth2 client instance using environment configuration or dynamic request host.
 * @param {Object} [req] - Express request object
 * @returns {google.auth.OAuth2}
 */
function createOAuth2Client(req) {
  const redirectUri = getRedirectUri(req);
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

/**
 * Generates the Google OAuth 2.0 consent URL for Gmail and Calendar read-only scopes.
 * @param {Object} [req] - Express request object
 * @returns {string} Auth consent screen URL
 */
function getAuthUrl(req) {
  const oAuth2Client = createOAuth2Client(req);
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

/**
 * Exchanges authorization code for tokens and stores tokens locally in GBrain store.
 * @param {string} code - Authorization code from Google OAuth callback
 * @param {Object} [req] - Express request object
 * @returns {Promise<Object>} { tokenDoc, user }
 */
async function handleCallback(code, req) {
  if (!code) {
    throw new Error('Authorization code is required');
  }

  const oAuth2Client = createOAuth2Client(req);
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  // Fetch Google User Profile info
  let googleUser = {};
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const userInfoRes = await oauth2.userinfo.get();
    googleUser = userInfoRes.data || {};
  } catch (err) {
    console.error('[googleAuthService] Failed to fetch Google userinfo profile:', err.message);
  }

  const existing = readTokenData() || {};
  const updateData = {
    userId: SINGLE_USER_ID,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || existing.refresh_token,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : existing.expiry,
    scope: tokens.scope || existing.scope,
    token_type: tokens.token_type || existing.token_type,
    user: {
      email: googleUser.email || 'user@personalbrain.local',
      name: googleUser.name || 'Personal User',
      picture: googleUser.picture || ''
    }
  };

  writeTokenData(updateData);
  console.log(`[googleAuthService] Token saved for user: ${updateData.user.email}`);
  return { tokenDoc: updateData, user: updateData.user };
}

/**
 * Retrieves the primary authenticated user from GBrain local store.
 */
async function getCurrentUser() {
  const data = readTokenData();
  return data ? data.user : null;
}

/**
 * Retrieves a ready, authenticated OAuth2 client with automatically managed tokens.
 */
async function getAuthedClient() {
  const tokenDoc = readTokenData();

  if (!tokenDoc || !tokenDoc.access_token) {
    throw new Error('No OAuth tokens found in database. Please authenticate at /auth/google first.');
  }

  const oAuth2Client = createOAuth2Client();

  oAuth2Client.setCredentials({
    access_token: tokenDoc.access_token,
    refresh_token: tokenDoc.refresh_token,
    expiry_date: tokenDoc.expiry ? new Date(tokenDoc.expiry).getTime() : undefined,
    scope: tokenDoc.scope,
    token_type: tokenDoc.token_type
  });

  // Listen for automatic token refresh events
  oAuth2Client.on('tokens', (newTokens) => {
    const current = readTokenData() || {};
    const updated = {
      ...current,
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || current.refresh_token,
      expiry: newTokens.expiry_date ? new Date(newTokens.expiry_date).toISOString() : current.expiry
    };
    writeTokenData(updated);
  });

  return oAuth2Client;
}

module.exports = {
  SINGLE_USER_ID,
  SCOPES,
  createOAuth2Client,
  getAuthUrl,
  handleCallback,
  getCurrentUser,
  getAuthedClient
};
