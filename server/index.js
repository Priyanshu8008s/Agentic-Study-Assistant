import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { runAgentLoop } from "./lib/agent.js";
import { appendMemoryEntry, getSessionMemory } from "./lib/memoryStore.js";
import { processAndStorePDF } from "./lib/rag.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";

app.use(cors());
app.use(express.json());

function buildInitiative(entries) {
  if (!entries.length) {
    return {
      nextTopic: "Start with a study guide for something you want to master this week.",
      recapSuggestion: null,
      message: "No prior memory yet. I can take initiative as soon as your first study topic is saved."
    };
  }

  const latest = entries[0];
  const now = Date.now();
  const daysSinceLastReview = Math.floor((now - latest.timestamp) / (1000 * 60 * 60 * 24));
  const nextTopic =
    latest.nextTopicSuggestion ||
    `A slightly more advanced topic connected to ${latest.topic}`;

  if (daysSinceLastReview > 2) {
    return {
      nextTopic,
      recapSuggestion: {
        topic: latest.topic,
        daysSinceLastReview
      },
      message: `You haven't reviewed ${latest.topic} in ${daysSinceLastReview} days — want a recap?`
    };
  }

  return {
    nextTopic,
    recapSuggestion: null,
    message: `You're actively building continuity from ${latest.topic}. Ready for the next step?`
  };
}

app.post("/api/agent", async (req, res) => {
  try {
    const { action, topic, sessionId } = req.body || {};

    if (!topic || !sessionId) {
      return res.status(400).json({
        error: "Both topic and sessionId are required."
      });
    }

    const memoryEntries = await getSessionMemory(sessionId);
    const result = await runAgentLoop({
      requestedAction: action,
      topic,
      sessionId,
      memoryEntries
    });

    const updatedEntries = await appendMemoryEntry(sessionId, result.entry);

    return res.json({
      ...result,
      memoryCount: updatedEntries.length
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Agent loop failed."
    });
  }
});

app.get("/api/memory/:sessionId", async (req, res) => {
  try {
    const entries = await getSessionMemory(req.params.sessionId);
    return res.json({
      sessionId: req.params.sessionId,
      entries
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Could not load memory."
    });
  }
});

app.post("/api/initiative", async (req, res) => {
  try {
    const { sessionId } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId is required."
      });
    }

    const entries = await getSessionMemory(sessionId);
    return res.json(buildInitiative(entries));
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Could not generate initiative."
});
  }
});

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/knowledge/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF files are supported." });
    }

    const result = await processAndStorePDF(req.file.buffer, req.file.originalname);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not process PDF." });
  }
});

app.listen(port, host, () => {
  console.log(`Agentic Study Assistant API running on http://${host}:${port}`);
});
