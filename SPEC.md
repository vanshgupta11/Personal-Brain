# Personal Brain - Specification

## 1. Problem Statement
Individuals frequently context-switch between email and calendar tools to manage schedules, track follow-ups, and verify meeting details. Information across Gmail and Google Calendar is fragmented, making cross-source verification (such as determining whether a meeting was confirmed via email or if an unreplied email relates to an upcoming calendar event) manual and tedious.

**Personal Brain** is a MERN-stack conversational agent designed to bridge this gap. It provides a unified natural-language interface that queries synchronized Gmail and Google Calendar data, utilizing reasoning across both sources to answer complex personal productivity queries.

## 2. Data Sources and Exact Fields
The application synchronizes data from two primary Google services into a local data store, tracking the exact fields listed below:

### Gmail
- `threadId`
- `messageId`
- `from`
- `to`
- `subject`
- `snippet`
- `bodyText`
- `date`
- `hasAttachments`
- `labels`

### Google Calendar
- `eventId`
- `summary`
- `description`
- `start`
- `end`
- `attendees`
- `organizer`
- `location`

## 3. Supported Query Types

### Tier 1
- "What's on my calendar tomorrow?"
- "Find the email from Stripe about the failed payment"
- "List my unread emails from this week"

### Tier 2
- "What meetings do I have this week, and which ones have a related email thread I haven't replied to?"
- "Did [person] ever confirm the meeting I scheduled with them?"

## 4. Architecture
The system relies on a modern full-stack decoupled architecture:

```
[ React Frontend ] <---> [ Express/Node Backend ] <---> [ GBrain Store ]
                                  |
                                  v
                    [ Gemini API (Function Calling) ]
```

- **React Frontend**: Interactive conversational chat interface and dashboard for displaying query responses, message snippets, and calendar event context.
- **Express/Node Backend**: REST/API services handling auth, synchronization jobs, query routing, and function-calling execution.
- **GBrain Store**: Persistent knowledge store (https://github.com/garrytan/gbrain) organizing synchronized Gmail threads/messages and Google Calendar events into structured entity pages with graph references.
- **Gemini API with Function Calling**: Intelligent engine that translates natural-language queries into structured tool calls, executing queries against GBrain, and synthesizing cross-source answers.

## 5. Non-Goals
- **No Write Actions (Read-Only)**: The system operates strictly as a read-only viewer and query assistant.
- **No Sending Emails**: The platform will not draft, send, or modify email messages.
- **No Creating Events**: The platform will not create, update, or delete calendar events or send meeting invites.

## 6. Commit References
> **Important Directive**: All future commits across this repository MUST reference the relevant section of this specification file (e.g., `feat(backend): implement schema matching section 2 of SPEC.md`).
