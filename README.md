# Agentic Study Assistant

Phase 1 prototype of a full-stack study app that simulates an AI "mind" with an agent loop:

`observe -> think -> decide -> act -> reflect -> repeat`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create an environment file:

   ```bash
   cp .env.example .env
   ```

3. Add your Gemini API key to `.env`:

   ```env
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-2.5-pro
   PORT=3001
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open `http://localhost:5173`

## Environment Variables

- `GEMINI_API_KEY`: Gemini API key from Google AI Studio.
- `GEMINI_MODEL`: Optional override for the model name. Defaults to `gemini-2.5-pro`.
- `PORT`: Express API port. Defaults to `3001`.

## API

### `POST /api/agent`

Request body:

```json
{
  "action": "study_guide",
  "topic": "Photosynthesis",
  "sessionId": "local-browser-session-id"
}
```

Behavior:

- loads session memory
- builds a memory-injected Gemini prompt
- decides the final mode
- generates content
- reflects on quality
- stores the result in memory
- returns the response plus next-topic suggestion

### `GET /api/memory/:sessionId`

Returns saved entries for a session, including topics, summaries, timestamps, and reflections.

### `POST /api/initiative`

Triggered on page load to generate proactive study guidance and recap prompts from memory.

## How The Agent Loop Works

1. `Observe`: the API receives a topic, selected tab, and session id.
2. `Think`: the backend injects recent memory into the Gemini prompt.
3. `Decide`: the server normalizes or infers the most suitable mode.
4. `Act`: the system returns a study guide, concept clarification, or podcast script.
5. `Reflect`: the response gets a quality score and improvement note.
6. `Repeat`: the loop proposes what to study next and stores that in memory for future runs.

## Frontend Features

- Study Guide tab with collapsible sections for overview, concepts, subtopics, and practice questions
- Study Guide mode now runs a lightweight research agent that fetches study links before building the guide
- Concepts tab with three-card outputs: simple explanation, analogy, and memory hook
- Podcast tab with a two-host script and browser `SpeechSynthesis` playback
- Persistent memory sidebar with past sessions, timestamps, and next-topic suggestion
- Autonomous initiative banner that appears on load and nudges recap behavior

## Memory Storage

Memory is stored in `server/data/memory.json` using a single-user JSON structure:

```json
{
  "sessions": {
    "session-id": {
      "sessionId": "session-id",
      "entries": [
        {
          "id": "uuid",
          "topic": "Photosynthesis",
          "summary": "A structured overview...",
          "timestamp": 1712240000000,
          "type": "study_guide",
          "reflection": "Score 100/100...",
          "nextTopicSuggestion": "Cellular respiration"
        }
      ]
    }
  }
}
```

## How This System Behaves Like A Mind

- It observes a learner prompt and current session context before responding.
- It thinks with memory, using past topics and reflections as working context.
- It decides between different behaviors instead of always replying the same way.
- It reflects on every output, scores itself, and stores an improvement note.
- It shows initiative by suggesting the next study step without waiting for a new prompt.

## Notes

- If `GEMINI_API_KEY` is missing or Gemini is temporarily unavailable, the prototype falls back to a local response generator so the app still runs for demos.
- Live study-resource fetching uses public web endpoints from Wikipedia and arXiv, with safe fallback links if the network is unavailable.
- Gemini integration follows the official Google GenAI SDK for JavaScript: [Gemini API libraries](https://ai.google.dev/gemini-api/docs/libraries) and [Gemini API quickstart](https://ai.google.dev/gemini-api/docs/quickstart).
