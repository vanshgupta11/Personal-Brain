const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const ingestRoutes = require('./routes/ingest');
const chatRoutes = require('./routes/chat');

/**
 * Express Application Configuration
 * Implements SPEC.md Section 4 Architecture setup
 */
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const gbrainService = require('./services/gbrainService');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/chat', chatRoutes);

// GBrain Store stats and inspection endpoint
app.get('/api/store/stats', async (req, res) => {
  try {
    const stats = await gbrainService.getStoreStats();
    res.json({ status: 'success', stats });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Clear entire GBrain Store
app.delete('/api/store/clear', async (req, res) => {
  try {
    const result = await gbrainService.clearStore();
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Delete specific email entity
app.delete('/api/store/email/:id', async (req, res) => {
  try {
    const deleted = await gbrainService.deleteEmail(req.params.id);
    res.json({ status: 'success', deleted });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Delete specific event entity
app.delete('/api/store/event/:id', async (req, res) => {
  try {
    const deleted = await gbrainService.deleteEvent(req.params.id);
    res.json({ status: 'success', deleted });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Personal Brain Server' });
});

// Serve built React client in production deployment
const path = require('path');
const fs = require('fs');
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

module.exports = app;
