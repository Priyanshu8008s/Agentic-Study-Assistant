import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_FILE = path.join(__dirname, "..", "data", "memory.json");

const defaultStore = {
  sessions: {}
};

async function ensureStoreFile() {
  try {
    await fs.access(MEMORY_FILE);
  } catch {
    await fs.writeFile(MEMORY_FILE, JSON.stringify(defaultStore, null, 2));
  }
}

async function readStore() {
  await ensureStoreFile();
  const raw = await fs.readFile(MEMORY_FILE, "utf-8");

  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(defaultStore);
  }
}

async function writeStore(store) {
  await fs.writeFile(MEMORY_FILE, JSON.stringify(store, null, 2));
}

export async function getSessionMemory(sessionId) {
  const store = await readStore();
  const session = store.sessions[sessionId];

  return session?.entries || [];
}

export async function appendMemoryEntry(sessionId, entry) {
  const store = await readStore();

  if (!store.sessions[sessionId]) {
    store.sessions[sessionId] = {
      sessionId,
      entries: []
    };
  }

  store.sessions[sessionId].entries.unshift(entry);
  await writeStore(store);
  return store.sessions[sessionId].entries;
}

export function buildMemoryContext(entries) {
  if (!entries.length) {
    return "No past sessions yet. Treat this as a fresh learner profile.";
  }

  return entries
    .slice(0, 6)
    .map(
      (entry, index) =>
        `${index + 1}. Topic: ${entry.topic}. Type: ${entry.type}. Summary: ${entry.summary}. Reflection: ${entry.reflection}. Timestamp: ${new Date(entry.timestamp).toISOString()}.`
    )
    .join("\n");
}
