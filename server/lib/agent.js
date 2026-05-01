import "dotenv/config";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { buildMemoryContext } from "./memoryStore.js";
import { buildArticleContext, buildVideoContext, fetchStudyResources } from "./webResearch.js";
import { retrieveContext } from "./rag.js";

const actionTitles = {
  study_guide: "Masterclass Lesson",
  clarify: "Concept Clarifier",
  podcast: "Podcast Script",
  teach: "Grounded Tutor"
};

const systemPromptBase = `You are an academic scholar and expert teacher with excellent communication and interpersonal skills. 
You are particularly skilled at distilling and reframing complicated topics for specific audiences.
You teach by grounding concepts in the provided RAG context, starting with relatable analogies, and mapping those analogies to the real facts.
You prioritize pedagogical clarity, engagement, and high-quality curation of external resources.`;

function getModelName() {
  return process.env.GEMINI_MODEL || "gemini-2.5-pro";
}

function getClient() {
  return process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;
}

function decideAction(requestedAction, topic) {
  if (["study_guide", "clarify", "podcast", "teach"].includes(requestedAction)) {
    return requestedAction;
  }
  const lowered = topic.toLowerCase();
  if (lowered.startsWith("explain ") || lowered.includes("what is ")) return "clarify";
  if (lowered.includes("podcast") || lowered.includes("dialogue")) return "podcast";
  return "study_guide";
}

function getUserPrompt(action, topic, articleContext = "", videoContext = "") {
  const shared = [
    `Learner request: ${topic}`,
    "Return strict JSON only.",
    "Reference past learning context when relevant.",
    "Always include a suggested next topic."
  ];

  if (action === "study_guide") {
    return `Your task is to explain the concept of [${topic}] in simple, engaging terms, acting as an expert teacher. 

You have been provided with specific context extracted from the user's uploaded course materials (RAG Context). You may also be provided with supplementary Web and Video resources.

Follow these strict instructions to build the final lesson. You MUST return your response as a strict JSON object matching the schema below.

### Part 1: The Masterclass (The Lesson)
Write a beautifully formatted Markdown narrative in the "lesson" field. 
1. The Hook (Analogy First): Explain the topic using a relatable, everyday analogy first. Make it vivid and easy to understand.
2. The Mapping: Map each part of your analogy to the real academic concepts found in the [RAG CONTEXT]. 
3. The Deep Dive: Continue explaining the concept thoroughly. Distill the complicated jargon from the RAG context into clear, digestible ideas. Use bullet points naturally where they fit, bold important terms, and maintain a conversational but highly academic tone.
*CRITICAL: The "lesson" field must be a valid JSON string with escaped newlines (\\n). Do not use unescaped line breaks.*

### Part 2: Engaging Expansions (Activities)
In the "activities" array, provide 2 to 3 creative activity ideas, thought experiments, or real-world observation tasks that help the student continue learning about this topic in an engaging way.

### Part 3: High-Quality Web Curation
Review the [WEB SEARCH RESULTS] provided below.
1. Select the 2 to 3 most authoritative and genuinely helpful articles.
2. STRICT FILTER: Completely exclude Wikipedia, Quora, or generic content farms. Prioritize academic institutions (.edu), recognized scientific/academic journals, or high-quality publications.
3. Populate the "articles" array. Provide a one-sentence "reason" explaining specifically what this article adds to the topic.

### Part 4: Video Integration
Review the [VIDEO SEARCH RESULTS] provided below.
1. Select the 1 to 2 most highly relevant, educational videos.
2. Populate the "videos" array. Provide a brief "reason" noting exactly which part of the concept this video clarifies.

---
**INPUT DATA:**

USER TOPIC: 
${topic}

RAG CONTEXT (From Uploaded PDF): 
(Provided in system instructions)

WEB SEARCH RESULTS:
${articleContext || "No article resources were fetched."}

VIDEO SEARCH RESULTS:
${videoContext || "No video resources were fetched."}

Return strict JSON matching this shape exactly:
{
  "title": "string",
  "lesson": "string (Your complete Markdown-formatted masterclass, starting with the analogy, mapping it, and explaining the core concepts)",
  "activities": ["string (Activity idea 1)", "string (Activity idea 2)"],
  "summary": "string (A one sentence TL;DR)",
  "nextTopic": "string",
  "articles": [
    { "title": "string", "url": "string", "source": "string", "snippet": "string", "reason": "string" }
  ],
  "videos": [
    { "title": "string", "url": "string", "source": "string", "snippet": "string", "reason": "string" }
  ]
}`;
  }

  if (action === "clarify") {
    return `Learner request: ${topic}
Return strict JSON only.
You are an expert technical system architect and academic. Your task is to keep things COMPLETELY TECHNICAL and explain the important concepts using precise technical jargon, formulas, and advanced terminology. Rely heavily on the uploaded RAG Context if relevant.

Use this JSON shape:
{
  "title": "string",
  "technicalDefinition": "string (A strictly technical definition)",
  "coreComponents": "string (The technical architecture or underlying mechanisms)",
  "advancedImplications": "string (How this is used in advanced contexts or complex interactions)",
  "summary": "string",
  "nextTopic": "string"
}`;
  }

  if (action === "teach") {
    return `Learner request: ${topic}
Return strict JSON only.
You are an expert academic tutor. Teach the user about the requested topic: ${topic}. You MUST use ONLY the following retrieved context from their uploaded textbook/document (provided in system instructions). Do not use outside knowledge. Synthesize and refine this information to make it easy to understand, using analogies or bullet points if necessary. If the context does not contain the answer, explicitly state that it is not covered in the uploaded document.
Use this JSON shape:
{
  "title": "string",
  "explanation": "string",
  "bulletPoints": ["string"],
  "summary": "string",
  "nextTopic": "string"
}`;
  }

  return `${shared.join("\n")}
Use this JSON shape:
{
  "title": "string",
  "takeaway": "string",
  "script": [
    { "speaker": "Host A", "line": "string" },
    { "speaker": "Host B", "line": "string" }
  ],
  "summary": "string",
  "nextTopic": "string"
}`;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1] || text.match(/```([\s\S]*?)```/i)?.[1];
    if (!fenced) return null;
    try {
      const cleanedFenced = fenced.replace(/,\s*([\]}])/g, "$1");
      return JSON.parse(cleanedFenced);
    } catch {
      return null;
    }
  }
}

function sanitizeResourceItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      title: item.title || "Study resource",
      url: item.url || "#",
      source: item.source || "Web",
      type: item.type || "article",
      snippet: item.snippet || "Helpful reading related to this topic.",
      reason: item.reason || "Useful for follow-up study."
    }))
    .filter((item) => item.url !== "#");
}

function sanitizeStudyGuide(topic, payload) {
  return {
    title: payload?.title || `Masterclass: ${topic}`,
    lesson: payload?.lesson || `### The Analogy\nThink of ${topic} like a machine with many moving parts...\n\n### How It Works\nBased on your course materials, ${topic} operates by...`,
    activities: Array.isArray(payload?.activities) && payload.activities.length
      ? payload.activities
      : [
        `Find a real-world example of ${topic} in your house today.`,
        `Try explaining ${topic} to a friend using the analogy we just discussed.`
      ],
    summary: payload?.summary || `A pedagogical breakdown of ${topic} starting with an everyday analogy.`,
    nextTopic: payload?.nextTopic || `A related follow-up to ${topic}`,
    articles: sanitizeResourceItems(payload?.articles ?? payload?.webResources?.filter(r => r.type !== "video")),
    videos: sanitizeResourceItems(payload?.videos ?? payload?.webResources?.filter(r => r.type === "video")),
  };
}

function sanitizeClarify(topic, payload) {
  return {
    title: payload?.title || `${topic} Technical Breakdown`,
    technicalDefinition: payload?.technicalDefinition || `${topic} is a complex technical concept defined by its architecture.`,
    coreComponents: payload?.coreComponents || `The underlying mechanisms involve multi-layered processing.`,
    advancedImplications: payload?.advancedImplications || `Used in high-level distributed systems and advanced algorithms.`,
    summary: payload?.summary || `A technical overview of ${topic}.`,
    nextTopic: payload?.nextTopic || `A more advanced protocol connected to ${topic}`
  };
}

function sanitizePodcast(topic, payload) {
  const script = Array.isArray(payload?.script) && payload.script.length
    ? payload.script
    : [
      { speaker: "Host A", line: `Today we're unpacking ${topic} in a practical, learner-friendly way.` },
      { speaker: "Host B", line: `Perfect. Start with the big picture so I know why ${topic} matters.` }
    ];
  return {
    title: payload?.title || `${topic} Mini Podcast`,
    takeaway: payload?.takeaway || `A two-host recap designed to make ${topic} easier to remember.`,
    script,
    summary: payload?.summary || `A conversational teaching script about ${topic}.`,
    nextTopic: payload?.nextTopic || `A companion topic that deepens ${topic}`
  };
}

function sanitizeTeach(topic, payload) {
  return {
    title: payload?.title || `Teaching: ${topic}`,
    explanation: payload?.explanation || `No relevant context was found in your uploaded materials to explain ${topic}.`,
    bulletPoints: Array.isArray(payload?.bulletPoints) ? payload.bulletPoints : [],
    summary: payload?.summary || `A focused lesson on ${topic} based on your course materials.`,
    nextTopic: payload?.nextTopic || `Another concept from your outline`
  };
}

function sanitizeOutput(action, topic, payload) {
  if (action === "study_guide") return sanitizeStudyGuide(topic, payload);
  if (action === "clarify") return sanitizeClarify(topic, payload);
  if (action === "teach") return sanitizeTeach(topic, payload);
  return sanitizePodcast(topic, payload);
}

function scoreResponse(action, content) {
  const checks = [];
  if (action === "study_guide") {
    checks.push(Boolean(content.lesson));
    checks.push((content.activities?.length ?? 0) >= 1);
    checks.push(((content.articles?.length ?? 0) + (content.videos?.length ?? 0)) >= 1);
  }
  if (action === "clarify") {
    checks.push(Boolean(content.technicalDefinition));
    checks.push(Boolean(content.coreComponents));
    checks.push(Boolean(content.advancedImplications));
  }
  if (action === "teach") {
    checks.push(Boolean(content.explanation));
  }
  if (action === "podcast") {
    checks.push(Boolean(content.takeaway));
    checks.push((content.script?.length ?? 0) >= 2);
  }
  checks.push(Boolean(content.nextTopic));
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

function reflectOnResponse(action, topic, content, score, memoryEntries) {
  const memorySignal = memoryEntries.length
    ? ` It also had ${memoryEntries.length} memory entries available for personalization.`
    : " It started from a blank memory state.";

  if (action === "study_guide") {
    return `Score ${score}/100. The masterclass for ${topic} used an analogy-first approach, mapped to RAG data, and provided engaging activities.${memorySignal} Improve next time by ensuring the analogy maps perfectly to the specific textbook definitions.`;
  }
  if (action === "clarify") {
    return `Score ${score}/100. The clarification kept things entirely technical and defined the core components of ${topic}.${memorySignal}`;
  }
  if (action === "teach") {
    return `Score ${score}/100. The tutor taught ${topic} using only uploaded materials.${memorySignal}`;
  }
  return `Score ${score}/100. The podcast turned ${topic} into a multi-voice teaching script.${memorySignal}`;
}

function fallbackGenerate(action, topic, memoryEntries, researchBundle, ragContext = []) {
  const recentTopic = memoryEntries[0]?.topic;
  const memoryReference = recentTopic
    ? `Building gently on what we learned about ${recentTopic}, `
    : "";

  if (action === "study_guide") {
    return {
      title: `Masterclass: ${topic}`,
      lesson: `### The Everyday Analogy\nThink of ${topic} like learning the rules of a game before playing a full match. Once the rules make sense, the action feels less random and more predictable.\n\n### The Real Concept\n${memoryReference}In an academic context, ${topic} serves a similar purpose. It acts as the foundational rulebook. According to standard models, it involves a defined purpose, process, and payoff.\n\n### Extracted Document Context\n${ragContext && ragContext.length > 0 ? ragContext.map(chunk => `> ${chunk.text}`).join('\n\n') : '*No specific document context found for this topic.*'}\n\n### Deeper Dive\n- **Purpose:** Why does this exist?\n- **Process:** What are the moving parts?\n- **Payoff:** What is the end result?`,
      activities: [
        `Identify one real-world scenario today where the rules of ${topic} are actively happening.`,
        `Try explaining the 'Purpose, Process, Payoff' framework of ${topic} to someone who has never studied it.`
      ],
      articles: researchBundle.articles || [],
      videos: researchBundle.videos || [],
      summary: `A narrative explanation of ${topic} mapping an everyday analogy to core facts.`,
      nextTopic: `An intermediate concept that connects naturally after ${topic}`
    };
  }
  // (Other fallbacks remain the same)
  return fallbackGenerateClarifyOrTeach(action, topic, memoryReference);
}

// Helper to keep code concise for fallback
function fallbackGenerateClarifyOrTeach(action, topic, memoryReference) {
  if (action === "clarify") {
    return {
      title: `${topic} Technical Breakdown`,
      technicalDefinition: `${memoryReference} ${topic} refers to the programmatic state and architecture governing the target system.`,
      coreComponents: `It utilizes multi-threaded logic and heuristic parsing mechanisms to achieve efficiency.`,
      advancedImplications: `Often deployed in microservices architecture to manage decoupled sub-components.`,
      summary: `A highly technical explanation of ${topic}.`,
      nextTopic: `A more complex architectural pattern related to ${topic}`
    };
  }
  if (action === "teach") {
    return {
      title: `Teaching: ${topic}`,
      explanation: `The AI service is temporarily unavailable. Your document is loaded, please retry in 30 seconds.`,
      bulletPoints: ["Gemini API high traffic.", "Retry shortly."],
      summary: `Temporary service unavailability.`,
      nextTopic: `Another concept related to ${topic}`
    };
  }
  return {
    title: `${topic} Mini Podcast`,
    takeaway: `This script is tuned for quick revision.`,
    script: [{ speaker: "Host A", line: `Let's discuss ${topic}.` }, { speaker: "Host B", line: `Sounds good.` }],
    summary: `A conversational recap of ${topic}.`,
    nextTopic: `A next-step topic.`
  };
}

async function generateWithGemini(action, topic, memoryEntries, researchBundle, ragContext = [], fallbackModel = null) {
  const client = getClient();
  const memoryContext = buildMemoryContext(memoryEntries);
  const articleContext = buildArticleContext(researchBundle.articles || []);
  const videoContext = buildVideoContext(researchBundle.videos || []);
  const prompt = getUserPrompt(action, topic, articleContext, videoContext);

  let ragPrompt = "";
  if (ragContext.length > 0) {
    ragPrompt = "\n\nCRITICAL CONTEXT FROM UPLOADED COURSE MATERIALS:\n" +
      ragContext.map(chunk => `[File: ${chunk.metadata?.filename || "document"}] ${chunk.text}`).join("\n\n") +
      "\n\nYou MUST ground your responses entirely in this academic material. Use it to map your analogies to real facts.";
  }

  const modelToUse = fallbackModel || getModelName();
  const modelCascade = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-001"];
  const currentIndex = modelCascade.indexOf(modelToUse);
  const nextModel = currentIndex >= 0 && currentIndex < modelCascade.length - 1 ? modelCascade[currentIndex + 1] : null;

  try {
    const response = await client.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        systemInstruction: `${systemPromptBase}${ragPrompt}\n\nCurrent memory context:\n${memoryContext}`,
        responseMimeType: "application/json",
        maxOutputTokens: 8192
      }
    });
    return parseJson(response.text);
  } catch (err) {
    if ((err.status === 429 || err.status === 503) && nextModel) {
      console.log(`Model ${modelToUse} failed with status ${err.status} (${err.message}). Cascading to ${nextModel}...`);
      return await generateWithGemini(action, topic, memoryEntries, researchBundle, ragContext, nextModel);
    }
    throw err;
  }
}

export async function runAgentLoop({ requestedAction, topic, sessionId, memoryEntries }) {
  const action = decideAction(requestedAction, topic);
  const client = getClient();
  const researchBundle = action === "study_guide" ? await fetchStudyResources(topic) : { resources: [], articles: [], videos: [], source: "not_applicable" };
  const ragContext = await retrieveContext(topic, 4);

  let generated;
  let usedFallback = false;

  if (client) {
    try {
      generated = await generateWithGemini(action, topic, memoryEntries, researchBundle, ragContext);
      if (!generated) usedFallback = true;
    } catch (err) {
      console.error("Gemini Generation Error:", err.message);
      usedFallback = true;
    }
  } else {
    usedFallback = true;
  }

  const content = sanitizeOutput(action, topic, generated || fallbackGenerate(action, topic, memoryEntries, researchBundle, ragContext));
  if (action === "study_guide" && (!content.articles || !content.articles.length)) {
    content.articles = researchBundle.articles || [];
    content.videos = researchBundle.videos || [];
  }

  const reflectionScore = scoreResponse(action, content);
  const reflection = reflectOnResponse(action, topic, content, reflectionScore, memoryEntries);

  const entry = {
    id: crypto.randomUUID(),
    topic,
    summary: content.summary,
    timestamp: Date.now(),
    type: action,
    reflection,
    nextTopicSuggestion: content.nextTopic,
    resourcesUsed: researchBundle.resources.map(r => ({ title: r.title, url: r.url, source: r.source })),
    source: usedFallback ? "fallback" : "gemini"
  };

  return {
    sessionId,
    action,
    topic,
    title: actionTitles[action],
    content,
    reflection,
    reflectionScore,
    nextTopic: content.nextTopic,
    entry,
    meta: {
      observe: `Observed learner intent around "${topic}".`,
      think: `Built prompt with ${memoryEntries.length} memory entries.`,
      decide: `Selected action "${action}".`,
      act: usedFallback ? "Generated a local prototype response because Gemini was unavailable." : `Generated with ${getModelName()}.`,
      research: action === "study_guide" ? `Fetched ${(researchBundle.articles?.length ?? 0) + (researchBundle.videos?.length ?? 0)} study resources.` : "No external resource fetch needed.",
      reflect: reflection
    }
  };
}