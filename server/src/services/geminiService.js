const { GoogleGenerativeAI } = require('@google/generative-ai');
const gbrainService = require('./gbrainService');

/**
 * Gemini Service with Function Calling
 * Implements Gemini API integration for cross-source reasoning across Gmail and Google Calendar
 * data stored in GBrain Store as specified in SPEC.md Section 3 & 4.
 */

/**
 * Tool definitions for Gemini function calling.
 * Optimized for cross-source correlation and query matching.
 */
const tools = [
  {
    functionDeclarations: [
      {
        name: 'search_emails',
        description: 'Searches stored emails in GBrain by keyword (matching subject, snippet, or body text), sender or recipient email/name, and date range (after, before). Returns emails sorted newest first.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search term or keyword to match subject, body text, or topic' },
            from: { type: 'STRING', description: 'Sender or recipient email address or name fragment to filter by' },
            after: { type: 'STRING', description: 'Start date boundary in ISO format (e.g. YYYY-MM-DD or YYYY-MM-THH:mm:ssZ)' },
            before: { type: 'STRING', description: 'End date boundary in ISO format (e.g. YYYY-MM-DD or YYYY-MM-THH:mm:ssZ)' }
          }
        }
      },
      {
        name: 'search_calendar_events',
        description: 'Searches stored Google Calendar events in GBrain by date range (startDate, endDate) and optional text query (summary, description, location, or attendee).',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Keyword to match event summary, description, location, or attendee name/email' },
            startDate: { type: 'STRING', description: 'Start date boundary in ISO format (e.g. YYYY-MM-DD or YYYY-MM-THH:mm:ssZ)' },
            endDate: { type: 'STRING', description: 'End date boundary in ISO format (e.g. YYYY-MM-DD or YYYY-MM-THH:mm:ssZ)' }
          }
        }
      }
    ]
  }
];

/**
 * Executes a search query on GBrain email store.
 */
async function searchEmails({ query, from, after, before }) {
  try {
    return await gbrainService.searchEmails({ query, from, after, before });
  } catch (err) {
    console.error('[geminiService] Error executing searchEmails:', err.message);
    return { status: 'no results found', resultCount: 0, emails: [], error: err.message };
  }
}

/**
 * Executes a search query on GBrain calendar event store.
 */
async function searchCalendarEvents({ query, startDate, endDate }) {
  try {
    return await gbrainService.searchCalendarEvents({ query, startDate, endDate });
  } catch (err) {
    console.error('[geminiService] Error executing searchCalendarEvents:', err.message);
    return { status: 'no results found', resultCount: 0, events: [], error: err.message };
  }
}

/**
 * Processes a natural-language query using Gemini API function calling over stored Gmail and Calendar data.
 * Uses generateContent directly with manual conversation history to support Gemini 3.x function calling format.
 * @param {string} userPrompt - User query
 * @returns {Promise<Object>} { reply, query }
 */
async function answerQuery(userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const now = new Date();
  const nowIso = now.toISOString();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  const systemInstruction = `You are a personal productivity assistant answering user questions strictly using data from Google Calendar and Gmail via the provided tools (search_calendar_events and search_emails).

RULES:
1. NEVER fabricate information or assume facts not present in tool responses.
2. If a tool call returns "no results found" or an empty list, explicitly state that no matching information was found.
3. Current local date and time: ${nowIso} (Day of week: ${dayOfWeek}).

FORMATTING RULES:
1. ALWAYS format your response using clean, structured Markdown (bold text, bullet points, headers like ###, tables when appropriate).
2. Highlight key details like event times, senders, email subjects, and reply status using **bold** text.
3. Use bullet points or numbered lists to present multiple events or emails clearly.

QUERY TYPES & REASONING GUIDANCE:
- For calendar queries ("What's on my calendar tomorrow/this week?"):
  Call search_calendar_events with appropriate startDate and endDate boundaries based on current local date.

- For email queries ("Find the email from..."):
  Call search_emails with appropriate query, from, or date parameters.

- For Tier 2 cross-referencing queries ("What meetings do I have this week, and which ones have a related email thread I haven't replied to?"):
  1. Call search_calendar_events for the relevant date range to fetch all meetings and their attendees.
  2. For each meeting found, extract attendee email addresses and meeting summary keywords.
  3. Call search_emails for those attendee emails or keywords to find related email threads.
  4. Compare the email thread messages: emails are returned newest first. Check the 'from' field of the latest email. If the latest message in the thread is from an external attendee (and not from the user), or if there is no reply from the user, mark that meeting as having an unreplied email thread.
  5. Clearly correlate calendar events with their corresponding email thread status in your final answer.`;

  const model = genAI.getGenerativeModel(
    {
      model: 'gemini-3.1-flash-lite',
      systemInstruction,
      tools
    },
    { apiVersion: 'v1beta' }
  );

  // Build conversation as a mutable contents array (Gemini 3.x format)
  const contents = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];

  let maxRounds = 6;
  let finalText = null;

  while (maxRounds > 0) {
    const result = await model.generateContent({ contents });
    const response = result.response;
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Append model turn to history
    contents.push({ role: 'model', parts });

    // Collect any function calls in this response
    const functionCallParts = parts.filter(p => p.functionCall);

    if (functionCallParts.length === 0) {
      // No more tool calls — extract final text answer
      finalText = parts.map(p => p.text || '').join('').trim();
      break;
    }

    // Execute each tool call and gather results
    const toolResponseParts = [];
    for (const part of functionCallParts) {
      const { name, args } = part.functionCall;
      let toolResult;

      if (name === 'search_emails') {
        toolResult = await searchEmails(args);
      } else if (name === 'search_calendar_events') {
        toolResult = await searchCalendarEvents(args);
      } else {
        toolResult = { status: 'no results found', error: `Unknown tool: ${name}` };
      }

      toolResponseParts.push({
        functionResponse: {
          name,
          response: toolResult
        }
      });
    }

    // Append tool results as a user turn (Gemini 3.x expects tool responses from user role)
    contents.push({ role: 'user', parts: toolResponseParts });
    maxRounds--;
  }

  if (!finalText) {
    finalText = 'I was unable to produce a final answer after processing the data.';
  }

  return {
    query: userPrompt,
    reply: finalText
  };
}

/**
 * Processes a query with streaming text output and real-time status callbacks for tool calls.
 * @param {string} userPrompt - User query
 * @param {function(string)} onChunk - Callback emitted when a text chunk is generated
 * @param {function(string)} onStatus - Callback emitted when status or tool state updates
 */
async function answerQueryStream(userPrompt, onChunk, onStatus) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const now = new Date();
  const nowIso = now.toISOString();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  const systemInstruction = `You are a personal productivity assistant answering user questions strictly using data from Google Calendar and Gmail via the provided tools (search_calendar_events and search_emails).

RULES:
1. NEVER fabricate information or assume facts not present in tool responses.
2. If a tool call returns "no results found" or an empty list, explicitly state that no matching information was found.
3. Current local date and time: ${nowIso} (Day of week: ${dayOfWeek}).

FORMATTING RULES:
1. ALWAYS format your response using clean, structured Markdown (bold text, bullet points, headers like ###, tables when appropriate).
2. Highlight key details like event times, senders, email subjects, and reply status using **bold** text.
3. Use bullet points or numbered lists to present multiple events or emails clearly.

QUERY TYPES & REASONING GUIDANCE:
- For calendar queries ("What's on my calendar tomorrow/this week?"):
  Call search_calendar_events with appropriate startDate and endDate boundaries based on current local date.

- For email queries ("Find the email from..."):
  Call search_emails with appropriate query, from, or date parameters.

- For Tier 2 cross-referencing queries ("What meetings do I have this week, and which ones have a related email thread I haven't replied to?"):
  1. Call search_calendar_events for the relevant date range to fetch all meetings and their attendees.
  2. For each meeting found, extract attendee email addresses and meeting summary keywords.
  3. Call search_emails for those attendee emails or keywords to find related email threads.
  4. Compare the email thread messages: emails are returned newest first. Check the 'from' field of the latest email. If the latest message in the thread is from an external attendee (and not from the user), or if there is no reply from the user, mark that meeting as having an unreplied email thread.
  5. Clearly correlate calendar events with their corresponding email thread status in your final answer.`;

  const model = genAI.getGenerativeModel(
    {
      model: 'gemini-3.1-flash-lite',
      systemInstruction,
      tools
    },
    { apiVersion: 'v1beta' }
  );

  const contents = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];

  let maxRounds = 6;

  while (maxRounds > 0) {
    if (onStatus) onStatus('Thinking and analyzing query...');

    const resultStream = await model.generateContentStream({ contents });

    let functionCallParts = [];
    let accumulatedParts = [];

    for await (const chunk of resultStream.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        accumulatedParts.push(part);
        if (part.text) {
          if (onChunk) onChunk(part.text);
        }
        if (part.functionCall) {
          functionCallParts.push(part);
        }
      }
    }

    // Append model turn to history
    contents.push({ role: 'model', parts: accumulatedParts });

    if (functionCallParts.length === 0) {
      // Completed response streaming without any new tool requests
      break;
    }

    // Execute tool calls and gather responses
    const toolResponseParts = [];
    for (const part of functionCallParts) {
      const { name, args } = part.functionCall;
      let toolResult;

      if (name === 'search_emails') {
        const queryLabel = args.query || args.from || 'messages';
        if (onStatus) onStatus(`🔍 Searching Gmail for "${queryLabel}"...`);
        toolResult = await searchEmails(args);
      } else if (name === 'search_calendar_events') {
        const queryLabel = args.query || args.startDate || 'events';
        if (onStatus) onStatus(`📅 Searching Google Calendar for "${queryLabel}"...`);
        toolResult = await searchCalendarEvents(args);
      } else {
        toolResult = { status: 'no results found', error: `Unknown tool: ${name}` };
      }

      toolResponseParts.push({
        functionResponse: {
          name,
          response: toolResult
        }
      });
    }

    contents.push({ role: 'user', parts: toolResponseParts });
    maxRounds--;
  }
}

module.exports = {
  tools,
  searchEmails,
  searchCalendarEvents,
  answerQuery,
  answerQueryStream
};
