/**
 * Authentication Routes
 * 
 * SPEC.md Reference:
 * - Section 4: Architecture ([ Express/Node Backend ] handling OAuth consent & callback endpoints)
 */

const express = require('express');
const router = express.Router();
const googleAuthService = require('../services/googleAuthService');

/**
 * @route   GET /auth/google (or /api/auth/google)
 * @desc    Redirects user to Google OAuth consent screen for Gmail & Calendar read-only permissions
 * @access  Public
 * SPEC.md Section 4 Architecture
 */
router.get('/google', (req, res) => {
  try {
    const authUrl = googleAuthService.getAuthUrl(req);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[OAuth Error] Failed to generate consent URL:', error);
    res.status(500).json({ error: 'Failed to initiate Google OAuth flow' });
  }
});

/**
 * @route   GET /auth/google/callback (or /api/auth/google/callback)
 * @desc    Handles Google OAuth2 callback, exchanges code for tokens, and stores them in GBrain store
 * @access  Public
 * SPEC.md Section 4 Architecture
 */
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  const redirectBase = process.env.NODE_ENV === 'production' ? '' : (req.headers.origin || 'http://localhost:3000');

  if (error) {
    console.error('[OAuth Error] Google authorization denied:', error);
    return res.redirect(`${redirectBase}/?auth=error&reason=` + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect(`${redirectBase}/?auth=error&reason=missing_code`);
  }

  try {
    const { tokenDoc, user } = await googleAuthService.handleCallback(code, req);
    console.log(`[OAuth] Authenticated user: ${user?.email || 'unknown'}`);
    // Redirect back to app with success flag
    res.redirect(`${redirectBase}/?auth=success&user=${encodeURIComponent(user?.name || user?.email || 'User')}`);
  } catch (err) {
    console.error('[OAuth Error] Failed to exchange code for tokens:', err.message);
    res.redirect(`${redirectBase}/?auth=error&reason=` + encodeURIComponent(err.message));
  }
});

/**
 * @route   GET /auth/me (or /api/auth/me)
 * @desc    Retrieves current authenticated User profile and sync status
 * @access  Public
 */
router.get('/me', async (req, res) => {
  try {
    const user = await googleAuthService.getCurrentUser();
    if (!user) {
      return res.status(404).json({ message: 'No authenticated user found. Please authenticate via OAuth.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch current user profile', details: err.message });
  }
});

module.exports = router;
