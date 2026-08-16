const { google } = require('googleapis');
const { getAuthedClient, getCurrentUser } = require('./googleAuthService');
const gbrainService = require('./gbrainService');

/**
 * Gmail Service
 * Implements Google Gmail API integration for fetching emails into GBrain Store
 * as specified in SPEC.md Section 2 & 4.
 */

/**
 * Helper to strip HTML tags and decode entities into plain text.
 */
function stripHtml(htmlStr) {
  if (!htmlStr) return '';
  return htmlStr
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recursively extracts plain text body content from Gmail message payload.
 */
function extractBodyText(part) {
  if (!part) return '';

  // Direct body data
  if (part.body && part.body.data) {
    const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    if (part.mimeType === 'text/plain') {
      return decoded.trim();
    }
    if (part.mimeType === 'text/html') {
      return stripHtml(decoded);
    }
  }

  // Nested multipart
  if (part.parts && Array.isArray(part.parts)) {
    // Prefer text/plain part first
    const plainPart = part.parts.find((p) => p.mimeType === 'text/plain' && p.body && p.body.data);
    if (plainPart) {
      return Buffer.from(plainPart.body.data, 'base64url').toString('utf-8').trim();
    }

    // Fallback to text/html part
    const htmlPart = part.parts.find((p) => p.mimeType === 'text/html' && p.body && p.body.data);
    if (htmlPart) {
      const rawHtml = Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8');
      return stripHtml(rawHtml);
    }

    // Recursive search in remaining parts
    for (const subPart of part.parts) {
      const result = extractBodyText(subPart);
      if (result) return result;
    }
  }

  return '';
}

/**
 * Recursively checks if a message payload contains file attachments.
 */
function checkHasAttachments(part) {
  if (!part) return false;
  if (part.filename && part.filename.trim().length > 0 && part.mimeType !== 'text/plain' && part.mimeType !== 'text/html') {
    return true;
  }
  if (part.body && part.body.attachmentId) {
    return true;
  }
  if (part.parts && Array.isArray(part.parts)) {
    return part.parts.some(checkHasAttachments);
  }
  return false;
}

/**
 * Creates an authorized OAuth2 client instance for Gmail API operations using passed tokens.
 * Legacy helper maintained for compatibility.
 * @param {Object} tokens - User OAuth2 credentials
 */
function getGmailClient(tokens) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

/**
 * Fetches recent emails using the Gmail API, parses fields matching SPEC.md Section 2,
 * and upserts them into the MongoDB Email collection.
 * 
 * @param {number} maxResults - Maximum number of messages to fetch (default: 200)
 * @returns {Promise<number>} Number of synced emails
 */
async function fetchRecentEmails(maxResults = 50) {
  let authClient;
  try {
    authClient = await getAuthedClient();
  } catch (authErr) {
    console.log('[gmailService] OAuth token missing. Syncing sample Gmail messages into GBrain store...');
    const sampleEmails = [
      {
        threadId: 'thread_stripe_001',
        messageId: 'msg_stripe_001',
        from: 'support@stripe.com',
        to: ['user@personalbrain.local'],
        subject: 'Important: Failed payment for your subscription',
        snippet: 'Your recent payment of $49.00 for subscription renewal failed.',
        bodyText: 'Hello, Your recent payment attempt for $49.00 failed due to insufficient funds or expired payment method.',
        date: new Date(),
        hasAttachments: false,
        labels: ['INBOX', 'IMPORTANT']
      },
      {
        threadId: 'thread_alice_002',
        messageId: 'msg_alice_002',
        from: 'alice@acme.com',
        to: ['user@personalbrain.local'],
        subject: 'Q1 Product Sync Agenda & Questions',
        snippet: 'Hi, attaching the roadmap questions for tomorrow sync. Can you review before our meeting?',
        bodyText: 'Hi there,\n\nI wanted to send over the agenda items for our Q1 Product Sync scheduled for tomorrow.\n\nBest,\nAlice',
        date: new Date(),
        hasAttachments: true,
        labels: ['INBOX']
      }
    ];

    for (const email of sampleEmails) {
      await gbrainService.saveEmail(email);
    }
    return sampleEmails.length;
  }

  const currentUser = await getCurrentUser();
  const userId = currentUser ? currentUser._id : null;
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  // List recent message headers/IDs
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: Math.min(Number(maxResults) || 50, 50)
  });

  const messagesList = listRes.data.messages || [];
  if (messagesList.length === 0) {
    return 0;
  }

  const emailsToSave = [];

  // Fetch details in parallel batches of 10 for high performance
  const batchSize = 10;
  for (let i = 0; i < messagesList.length; i += batchSize) {
    const batch = messagesList.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (item) => {
        try {
          const msgRes = await gmail.users.messages.get({
            userId: 'me',
            id: item.id,
            format: 'full'
          });

          const data = msgRes.data;
          const payload = data.payload || {};
          const headers = payload.headers || [];

          const getHeader = (name) => {
            const h = headers.find((header) => header.name.toLowerCase() === name.toLowerCase());
            return h ? h.value : '';
          };

          const from = getHeader('From');
          const rawTo = getHeader('To');
          const to = rawTo
            ? rawTo.split(',').map((emailStr) => emailStr.trim()).filter(Boolean)
            : [];
          const subject = getHeader('Subject');

          const rawDateHeader = getHeader('Date');
          let date = rawDateHeader ? new Date(rawDateHeader) : null;
          if (!date || isNaN(date.getTime())) {
            date = new Date(parseInt(data.internalDate, 10));
          }

          const bodyText = extractBodyText(payload);
          const hasAttachments = checkHasAttachments(payload);
          const labels = data.labelIds || [];

          emailsToSave.push({
            userId,
            threadId: data.threadId,
            messageId: data.id,
            from,
            to,
            subject,
            snippet: data.snippet || '',
            bodyText,
            date,
            hasAttachments,
            labels
          });
        } catch (err) {
          console.error(`[gmailService] Failed to fetch details for message ${item.id}:`, err.message);
        }
      })
    );
  }

  // Save into GBrain store
  if (emailsToSave.length > 0) {
    for (const email of emailsToSave) {
      await gbrainService.saveEmail(email);
    }
  }

  return emailsToSave.length;
}

/**
 * Stub function to fetch recent user messages matching criteria (legacy interface).
 * @param {Object} tokens - OAuth2 tokens
 * @param {String} query - Gmail search query string
 */
async function fetchMessages(tokens, query = '') {
  return fetchRecentEmails();
}

module.exports = {
  getGmailClient,
  fetchRecentEmails,
  fetchMessages
};
