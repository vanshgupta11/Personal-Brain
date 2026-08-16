# Personal Brain

Personal Brain is a conversational agent built on Express, React, Node.js combined with **GBrain** (https://github.com/garrytan/gbrain) as the persistent memory store and **Gemini API (Function Calling)**. It allows users to ask natural-language questions across their synchronized Gmail and Google Calendar data.

For full project requirements, query types, exact field specs, and architectural details, please refer to [SPEC.md](SPEC.md).

---

## Project Structure

```
/
├── SPEC.md             # Core specification document
├── README.md           # Getting started and setup guide
├── server/             # Express/Node backend & GBrain integration
│   ├── src/
│   │   ├── services/   # Integrations (gbrainService, gmailService, calendarService, geminiService)
│   │   ├── routes/     # API Endpoints (auth, ingest, chat)
│   │   ├── app.js      # Express app setup & middleware
│   │   └── server.js   # Server entry point & database connection
│   ├── .env.example    # Environment variable template
│   └── package.json    # Server dependencies
└── client/             # React frontend (Vite)
    ├── src/
    │   ├── components/ # ChatWindow and UI components
    │   ├── App.jsx     # Main React layout
    │   └── index.css   # Modern dark-mode styling
    ├── index.html
    └── package.json    # Client dependencies
```

---

## Setup & Running Locally

### Prerequisites
- **Node.js**: v18+ installed
- **GBrain**: Knowledge store initialized in local data directory
- **Google Cloud Platform Project**: Enabled Gmail API & Google Calendar API with OAuth2 credentials
- **Gemini API Key**: API key from Google AI Studio

---

### 1. Server Setup

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Populate environment variables in `.env`:
   - `GBRAIN_DATA_DIR`: `./data/gbrain`
   - `GOOGLE_CLIENT_ID`: OAuth 2.0 Client ID from GCP
   - `GOOGLE_CLIENT_SECRET`: OAuth 2.0 Client Secret from GCP
   - `GOOGLE_REDIRECT_URI`: `http://localhost:5000/api/auth/google/callback`
   - `GEMINI_API_KEY`: API key from Google AI Studio

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The server will run at `http://localhost:5000`.*

---

### 2. Client Setup

1. Open a new terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *The client application will run at `http://localhost:3000` and proxy API requests to the backend.*

---

## Specification Reference

All features and API endpoints correspond directly to [SPEC.md](SPEC.md):
- **Data Models**: Section 2 (Gmail & Calendar fields)
- **Queries Supported**: Section 3 (Tier 1 & Tier 2 natural language queries)
- **Architecture**: Section 4 (React $\rightarrow$ Express $\rightarrow$ MongoDB $\rightarrow$ Gemini Function Calling)
- **Non-Goals**: Section 5 (Strictly read-only; no sending emails or creating events)
