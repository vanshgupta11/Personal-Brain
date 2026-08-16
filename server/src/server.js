require('dotenv').config();
const app = require('./app');
const gbrainService = require('./services/gbrainService');

const PORT = process.env.PORT || 5000;

/**
 * Initialize GBrain Data Store and start Express server
 * Implements SPEC.md Section 4 Architecture (Express Backend -> GBrain Store)
 */
gbrainService.init();

app.listen(PORT, () => {
  console.log(`[Personal Brain Server] Running on http://localhost:${PORT} with GBrain Store`);
});

