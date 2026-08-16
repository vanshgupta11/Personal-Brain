const fs = require('fs');
const path = require('path');

/**
 * GBrain Storage & Synthesis Engine Adapter
 * Implements persistent entity storage as markdown/JSON entity pages with structured metadata
 * and graph relations as defined in GBrain specification (https://github.com/garrytan/gbrain).
 */

const BASE_DATA_DIR = process.env.GBRAIN_DATA_DIR || path.join(__dirname, '../../data/gbrain');
const EMAILS_DIR = path.join(BASE_DATA_DIR, 'emails');
const EVENTS_DIR = path.join(BASE_DATA_DIR, 'events');

function ensureDirectories() {
  if (!fs.existsSync(BASE_DATA_DIR)) fs.mkdirSync(BASE_DATA_DIR, { recursive: true });
  if (!fs.existsSync(EMAILS_DIR)) fs.mkdirSync(EMAILS_DIR, { recursive: true });
  if (!fs.existsSync(EVENTS_DIR)) fs.mkdirSync(EVENTS_DIR, { recursive: true });
}

/**
 * Initializes the GBrain data store directories.
 */
function init() {
  ensureDirectories();
  console.log(`[GBrain Engine] Persistent store initialized at: ${BASE_DATA_DIR}`);
}

/**
 * Save an email into the GBrain store as an entity page.
 * @param {Object} emailData 
 */
async function saveEmail(emailData) {
  ensureDirectories();
  const filename = `email_${emailData.messageId || Date.now()}.json`;
  const filePath = path.join(EMAILS_DIR, filename);

  const entity = {
    type: 'email',
    threadId: emailData.threadId,
    messageId: emailData.messageId,
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject,
    snippet: emailData.snippet,
    bodyText: emailData.bodyText,
    date: emailData.date ? new Date(emailData.date).toISOString() : new Date().toISOString(),
    hasAttachments: Boolean(emailData.hasAttachments),
    labels: emailData.labels || []
  };

  fs.writeFileSync(filePath, JSON.stringify(entity, null, 2), 'utf8');
  return entity;
}

/**
 * Save a calendar event into the GBrain store as an entity page.
 * @param {Object} eventData 
 */
async function saveEvent(eventData) {
  ensureDirectories();
  const filename = `event_${eventData.eventId || Date.now()}.json`;
  const filePath = path.join(EVENTS_DIR, filename);

  const entity = {
    type: 'event',
    eventId: eventData.eventId,
    summary: eventData.summary,
    description: eventData.description,
    start: eventData.start ? new Date(eventData.start).toISOString() : null,
    end: eventData.end ? new Date(eventData.end).toISOString() : null,
    attendees: eventData.attendees || [],
    organizer: eventData.organizer,
    location: eventData.location
  };

  fs.writeFileSync(filePath, JSON.stringify(entity, null, 2), 'utf8');
  return entity;
}

/**
 * Search stored emails in GBrain
 * @param {Object} params { query, from, after, before }
 */
async function searchEmails({ query, from, after, before } = {}) {
  ensureDirectories();
  const files = fs.readdirSync(EMAILS_DIR);
  let results = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = fs.readFileSync(path.join(EMAILS_DIR, file), 'utf8');
      const email = JSON.parse(content);

      let matches = true;

      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        const subjectMatch = email.subject && email.subject.toLowerCase().includes(q);
        const snippetMatch = email.snippet && email.snippet.toLowerCase().includes(q);
        const bodyMatch = email.bodyText && email.bodyText.toLowerCase().includes(q);
        const fromMatch = email.from && email.from.toLowerCase().includes(q);
        const toMatch = Array.isArray(email.to) && email.to.some(t => t.toLowerCase().includes(q));
        if (!subjectMatch && !snippetMatch && !bodyMatch && !fromMatch && !toMatch) {
          matches = false;
        }
      }

      if (from && from.trim()) {
        const f = from.trim().toLowerCase();
        const fromMatch = email.from && String(email.from).toLowerCase().includes(f);
        const toMatch = Array.isArray(email.to)
          ? email.to.some(t => String(t).toLowerCase().includes(f))
          : (email.to && String(email.to).toLowerCase().includes(f));
        if (!fromMatch && !toMatch) {
          matches = false;
        }
      }

      if (email.date) {
        const emailTime = new Date(email.date).getTime();
        if (after) {
          const afterTime = new Date(after).getTime();
          if (!isNaN(afterTime) && emailTime < afterTime) matches = false;
        }
        if (before) {
          const beforeTime = new Date(before).getTime();
          if (!isNaN(beforeTime) && emailTime > beforeTime) matches = false;
        }
      }

      if (matches) {
        results.push(email);
      }
    } catch (err) {
      console.error(`[GBrain Store] Failed to parse email file ${file}:`, err.message);
    }
  }

  // Sort newest first
  results.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    status: results.length > 0 ? 'success' : 'no results found',
    resultCount: results.length,
    emails: results
  };
}

/**
 * Search stored calendar events in GBrain
 * @param {Object} params { query, startDate, endDate }
 */
async function searchCalendarEvents({ query, startDate, endDate } = {}) {
  ensureDirectories();
  const files = fs.readdirSync(EVENTS_DIR);
  let results = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = fs.readFileSync(path.join(EVENTS_DIR, file), 'utf8');
      const event = JSON.parse(content);

      let matches = true;

      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        const summaryMatch = event.summary && event.summary.toLowerCase().includes(q);
        const descMatch = event.description && event.description.toLowerCase().includes(q);
        const locMatch = event.location && event.location.toLowerCase().includes(q);
        const orgMatch = event.organizer && event.organizer.toLowerCase().includes(q);
        const attendeeMatch = Array.isArray(event.attendees) && event.attendees.some(a => 
          (a.email && a.email.toLowerCase().includes(q)) || 
          (a.displayName && a.displayName.toLowerCase().includes(q))
        );

        if (!summaryMatch && !descMatch && !locMatch && !orgMatch && !attendeeMatch) {
          matches = false;
        }
      }

      if (event.start) {
        const startTime = new Date(event.start).getTime();
        if (startDate) {
          const sTime = new Date(startDate).getTime();
          if (!isNaN(sTime) && startTime < sTime) matches = false;
        }
        if (endDate) {
          const eTime = new Date(endDate).getTime();
          if (!isNaN(eTime) && startTime > eTime) matches = false;
        }
      }

      if (matches) {
        results.push(event);
      }
    } catch (err) {
      console.error(`[GBrain Store] Failed to parse event file ${file}:`, err.message);
    }
  }

  // Sort earliest start date first
  results.sort((a, b) => new Date(a.start) - new Date(b.start));

  return {
    status: results.length > 0 ? 'success' : 'no results found',
    resultCount: results.length,
    events: results
  };
}

/**
 * Returns summary statistics and recent entity listings for UI store inspector
 */
async function getStoreStats() {
  const emailFiles = fs.existsSync(EMAILS_DIR) ? fs.readdirSync(EMAILS_DIR).filter(f => f.endsWith('.json')) : [];
  const eventFiles = fs.existsSync(EVENTS_DIR) ? fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith('.json')) : [];

  const emails = [];
  for (const file of emailFiles.slice(0, 15)) {
    try {
      const content = fs.readFileSync(path.join(EMAILS_DIR, file), 'utf8');
      emails.push(JSON.parse(content));
    } catch (e) {}
  }

  const events = [];
  for (const file of eventFiles.slice(0, 15)) {
    try {
      const content = fs.readFileSync(path.join(EVENTS_DIR, file), 'utf8');
      events.push(JSON.parse(content));
    } catch (e) {}
  }

  return {
    emailCount: emailFiles.length,
    eventCount: eventFiles.length,
    recentEmails: emails,
    recentEvents: events
  };
}
/**
 * Clears all stored email and event files in GBrain store
 */
async function clearStore() {
  if (fs.existsSync(EMAILS_DIR)) {
    const files = fs.readdirSync(EMAILS_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(EMAILS_DIR, file));
    }
  }
  if (fs.existsSync(EVENTS_DIR)) {
    const files = fs.readdirSync(EVENTS_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(EVENTS_DIR, file));
    }
  }
  return { status: 'success', message: 'GBrain store cleared completely' };
}

/**
 * Deletes a single email entity file
 */
async function deleteEmail(messageId) {
  const filePath = path.join(EMAILS_DIR, `email_${messageId}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Deletes a single event entity file
 */
async function deleteEvent(eventId) {
  const filePath = path.join(EVENTS_DIR, `event_${eventId}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

module.exports = {
  init,
  saveEmail,
  saveEvent,
  searchEmails,
  searchCalendarEvents,
  getStoreStats,
  clearStore,
  deleteEmail,
  deleteEvent
};
