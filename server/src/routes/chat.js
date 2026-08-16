const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');

/**
 * Conversational Chat Routes
 * 
 * SPEC.md References:
 * - Section 3: Supported query types (Tier 1 & Tier 2 questions)
 * - Section 4: Express Backend <---> Gemini API (Function Calling) <---> MongoDB Store
 */

// @route   POST /api/chat
// @desc    Process natural-language query using Gemini API function calling over stored Gmail and Calendar data
// @access  Public
// Implements SPEC.md Section 3 (Tier 1 & Tier 2 query handling) & Section 4 (Gemini function calling)
router.post('/', async (req, res) => {
  const query = req.body.query || req.body.message;
  const isStream = req.body.stream !== false && (req.headers.accept === 'text/event-stream' || req.body.stream === true);

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query string is required in request body.' });
  }

  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      await geminiService.answerQueryStream(
        query.trim(),
        (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
        },
        (status) => {
          res.write(`data: ${JSON.stringify({ type: 'status', message: status })}\n\n`);
        }
      );
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (error) {
      console.error('[Chat Stream Error] Failed to stream query with Gemini API:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  } else {
    try {
      const response = await geminiService.answerQuery(query.trim());
      res.json({
        query: response.query,
        reply: response.reply,
        status: 'success'
      });
    } catch (error) {
      console.error('[Chat Error] Failed to process query with Gemini API:', error.message);
      res.status(500).json({
        error: 'Failed to process chat query',
        details: error.message,
        status: 'error'
      });
    }
  }
});

module.exports = router;
