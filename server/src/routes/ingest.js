const express = require('express');
const router = express.Router();
const gmailService = require('../services/gmailService');
const calendarService = require('../services/calendarService');

/**
 * Data Ingestion Routes
 * 
 * SPEC.md References:
 * - Section 2: Data sources and exact fields (Gmail & Google Calendar schemas)
 * - Section 4: Express/Node backend -> MongoDB store ingestion pipeline
 * - Section 5: Non-goals (Read-only sync, no write actions)
 */

// @route   POST /api/ingest/gmail
// @desc    Sync Gmail messages into GBrain matching SPEC.md Section 2 fields
// @access  Public
// Implements SPEC.md Section 2 (Gmail fields) & Section 4 (GBrain store)
router.post('/gmail', async (req, res) => {
  try {
    const maxResults = req.body.maxResults || req.query.maxResults || 200;
    const syncedCount = await gmailService.fetchRecentEmails(Number(maxResults));

    res.json({
      message: 'Gmail emails synced successfully into GBrain store',
      syncedCount,
      status: 'success'
    });
  } catch (error) {
    console.error('[Ingest Error] Failed to sync Gmail messages:', error.message);
    res.status(500).json({
      error: 'Failed to sync Gmail messages',
      details: error.message,
      syncedCount: 0,
      status: 'error'
    });
  }
});

// @route   POST /api/ingest/calendar
// @desc    Sync Google Calendar events into GBrain matching SPEC.md Section 2 fields
// @access  Public
// Implements SPEC.md Section 2 (Calendar fields) & Section 4 (GBrain store)
router.post('/calendar', async (req, res) => {
  try {
    const timeMin = req.body.timeMin || req.query.timeMin;
    const timeMax = req.body.timeMax || req.query.timeMax;

    const syncedCount = await calendarService.fetchEvents(timeMin, timeMax);

    res.json({
      message: 'Calendar events synced successfully',
      syncedCount,
      status: 'success'
    });
  } catch (error) {
    console.error('[Ingest Error] Failed to sync Calendar events:', error.message);
    res.status(500).json({
      error: 'Failed to sync Calendar events',
      details: error.message,
      syncedCount: 0,
      status: 'error'
    });
  }
});

module.exports = router;
