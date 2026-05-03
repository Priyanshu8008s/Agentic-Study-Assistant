# Agentic Study Assistant

A full-stack, AI-powered academic tutor that transforms uploaded course materials into rich, multimedia study guides. Built on a RAG (Retrieval-Augmented Generation) pipeline, the agent grounds every response in the student's own uploaded PDF before synthesising explanations using the Gemini API.

The system follows a cognitive agent loop:

```
observe → think → decide → act → reflect → repeat
```

---

## Features

### 📄 PDF Upload & RAG Pipeline
- Upload any course PDF and the system parses, chunks, and embeds the text into a local [ChromaDB](https://www.trychroma.com/) vector database.
- All subsequent study guide responses are grounded in your specific document, not generic internet knowledge.
- Automatically generates a structured **Course Outline** (topics & subtopics) from the uploaded document.

### 🎓 Masterclass Study Guide (Study Guide Tab)
- Produces a pedagogically structured, Markdown-formatted lesson rendered with full syntax support (headings, bold, bullets).
- **Analogy-first approach** — starts with a relatable everyday analogy, then maps it to the real academic concept from the RAG context.
- Includes **Engaging Activities** — hands-on tasks and thought experiments to extend understanding.
- Curated **📚 Deep Dive Reading** — 2–3 arXiv/academic articles filtered for quality (Wikipedia and content farms excluded).
- Curated **🎥 Watch & Learn** — relevant educational YouTube videos with a per-video annotation on what concept it clarifies.

### 🔬 Concepts Tab (Technical Breakdown)
- Completely technical output — no analogies, no simplification.
- Returns three precision-focused sections:
  - **Technical Definition** — exact, jargon-heavy academic definition
  - **Core Components** — underlying mechanisms and architecture
  - **Advanced Implications** — use in high-level or complex contexts

### 🧠 Session Memory
- Every interaction is saved per-session to `server/data/memory.json`.
- The agent injects recent session history into each new prompt for personalised, continuity-aware responses.
- A persistent **Memory Sidebar** shows past topics, timestamps, quality scores, and next-topic suggestions.

### 🔁 Model Cascade (Resilience)
- Automatically cascades through models on quota or service errors:
  `gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash-001`
- Falls back to a local prototype generator (using the raw RAG chunks) if all API calls fail, so the app never crashes for the user.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Node.js, Express 5 |
| AI | Google Gemini API (`@google/genai`) |
| Vector DB | ChromaDB (Docker) |
| Embeddings | `gemini-embedding-2` |
| PDF Parsing | `pdf-parse` |
| Text Splitting | `@langchain/textsplitters` |
| Web Research | arXiv API + YouTube RSS |
| Markdown Rendering | `react-markdown` |

---

## Setup

### Prerequisites
- Node.js ≥ 18
- Docker (for ChromaDB)
- A [Gemini API key](https://aistudio.google.com/)

### 1. Start ChromaDB

```bash
docker run -p 8000:8000 chromadb/chroma
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

```bash
cp .env.example .env
```

Edit `.env`:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-pro
PORT=3001
```

### 4. Start the app

```bash
npm start
```

Opens the Vite dev server at `http://localhost:5173` and the Express API at `http://localhost:3001`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Your Gemini API key from Google AI Studio |
| `GEMINI_MODEL` | `gemini-2.5-pro` | Primary Gemini model to use |
| `PORT` | `3001` | Express API port |

---

## API Reference

### `POST /api/agent`

Runs the agent loop and returns a study response.

```json
{
  "action": "study_guide",
  "topic": "Transformer Architecture",
  "sessionId": "your-session-uuid"
}
```

**Actions:** `study_guide` | `clarify`

**Response includes:**
- `content` — the structured lesson, definitions, or breakdown
- `reflection` — quality score and self-improvement note
- `reflectionScore` — numeric 0–100
- `nextTopic` — suggested follow-up concept
- `meta` — agent loop trace (`observe`, `think`, `decide`, `act`, `research`, `reflect`)

### `POST /api/upload-pdf`

Accepts a `multipart/form-data` request with a `pdf` file. Parses, chunks, embeds, and stores the document. Also returns the auto-generated course outline.

### `GET /api/memory/:sessionId`

Returns all saved session entries including topics, summaries, timestamps, and reflections.

### `POST /api/initiative`

Called on page load. Returns a proactive study nudge based on memory — e.g. recap suggestions for topics not reviewed in 2+ days.

---

## How the Agent Loop Works

| Step | What Happens |
|------|-------------|
| **Observe** | API receives topic, action, and session ID |
| **Think** | Recent memory entries are injected into the Gemini prompt |
| **Decide** | Server infers the correct mode (`study_guide`, `clarify`, etc.) |
| **Act** | Generates content grounded in RAG context + web/video resources |
| **Reflect** | Scores the output and stores an improvement note |
| **Repeat** | Proposes the next study step and saves to memory |

---

## Project Structure

```
.
├── client/
│   └── src/
│       ├── components/
│       │   ├── CourseOutline.jsx    # PDF-derived topic navigator
│       │   ├── DocumentUpload.jsx   # PDF upload UI
│       │   ├── MemorySidebar.jsx    # Session history panel
│       │   ├── ResponsePanel.jsx    # Renders all study outputs
│       │   └── TutorInput.jsx      # Topic input field
│       └── App.jsx                 # Main layout + routing logic
├── server/
│   ├── lib/
│   │   ├── agent.js                # Agent loop, prompts, sanitizers
│   │   ├── rag.js                  # ChromaDB + embedding pipeline
│   │   ├── webResearch.js          # arXiv + YouTube fetchers
│   │   └── memoryStore.js          # Session memory read/write
│   ├── data/
│   │   └── memory.json             # Persistent session storage
│   └── index.js                    # Express server + routes
└── README.md
```

---

## Notes

- The embedding quota for `gemini-embedding-2` is 1,000 requests/day on the free tier. If exceeded, embeddings fall back to zero vectors (RAG retrieval will not match, but the app won't crash).
- The ChromaDB collection is named `academic_materials_v2`. If you change embedding models, drop the old collection or rename it to avoid dimension-mismatch errors.
- Web research uses the arXiv public API (no key needed) and YouTube RSS search feeds. If these are unavailable, the agent falls back to curated search links.
