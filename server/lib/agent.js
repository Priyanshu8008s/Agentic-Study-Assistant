import "dotenv/config";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { buildMemoryContext } from "./memoryStore.js";
import { buildResearchContext, fetchStudyResources } from "./webResearch.js";

const actionTitles = {
  study_guide: "Study Guide",
  clarify: "Concept Clarifier",
  podcast: "Podcast Script"
};

const systemPromptBase = `You are an agentic study assistant with memory.
You remember past sessions and personalize responses.
You proactively suggest what to study next.
You always reflect on your output and note improvements.`;

function getModelName() {
  return process.env.GEMINI_MODEL || "gemini-2.5-pro";
}

function getClient() {
  return process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;
}

function decideAction(requestedAction, topic) {
  if (["study_guide", "clarify", "podcast"].includes(requestedAction)) {
    return requestedAction;
  }

  const lowered = topic.toLowerCase();

  if (lowered.startsWith("explain ") || lowered.includes("what is ")) {
    return "clarify";
  }

  if (lowered.includes("podcast") || lowered.includes("dialogue")) {
    return "podcast";
  }

  return "study_guide";
}

function getUserPrompt(action, topic, researchContext = "") {
  const shared = [
    `Learner request: ${topic}`,
    "Return strict JSON only.",
    "Reference past learning context when relevant.",
    "Always include a suggested next topic."
  ];

  if (action === "study_guide") {
    return `${shared.join("\n")}

External study resources:
${researchContext || "No external resources were fetched."}

Use this JSON shape:
{
  "title": string,
  "overview": string,
  "keyConcepts": string[],
  "subtopics": string[],
  "practiceQuestions": string[],
  "summary": string,
  "nextTopic": string
}`;
  }

  if (action === "clarify") {
    return `${shared.join("\n")}

Use this JSON shape:
{
  "title": string,
  "simpleExplanation": string,
  "analogy": string,
  "memoryHook": string,
  "summary": string,
  "nextTopic": string
}`;
  }

  return `${shared.join("\n")}

Use this JSON shape:
{
  "title": string,
  "takeaway": string,
  "script": [
    { "speaker": "Host A", "line": string },
    { "speaker": "Host B", "line": string }
  ],
  "summary": string,
  "nextTopic": string
}`;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1] || text.match(/```([\s\S]*?)```/i)?.[1];
    if (!fenced) {
      return null;
    }

    try {
      return JSON.parse(fenced);
    } catch {
      return null;
    }
  }
}

function sanitizeResourceItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

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
    title: payload?.title || `${topic} Study Guide`,
    overview: payload?.overview || `This guide introduces the main ideas behind ${topic}.`,
    keyConcepts: Array.isArray(payload?.keyConcepts) && payload.keyConcepts.length
      ? payload.keyConcepts
      : [
          `Define the core idea behind ${topic}.`,
          `Identify the major components or stages within ${topic}.`,
          `Connect ${topic} to a real-world example.`
        ],
    subtopics: Array.isArray(payload?.subtopics) && payload.subtopics.length
      ? payload.subtopics
      : [`Foundations of ${topic}`, `Applications of ${topic}`, `Common mistakes in ${topic}`],
    practiceQuestions: Array.isArray(payload?.practiceQuestions) && payload.practiceQuestions.length
      ? payload.practiceQuestions
      : [
          `How would you explain ${topic} to a beginner?`,
          `What are the most important parts of ${topic}?`,
        `Where does ${topic} matter in practice?`
      ],
    summary: payload?.summary || `A starter guide that breaks ${topic} into core concepts and review questions.`,
    nextTopic: payload?.nextTopic || `A related follow-up to ${topic}`,
    webResources: sanitizeResourceItems(payload?.webResources)
  };
}

function sanitizeClarify(topic, payload) {
  return {
    title: payload?.title || `${topic} Explained Simply`,
    simpleExplanation:
      payload?.simpleExplanation || `${topic} can be understood by breaking it into its most basic moving parts.`,
    analogy:
      payload?.analogy || `${topic} is like learning a simple map before exploring a larger city.`,
    memoryHook: payload?.memoryHook || `${topic}: learn the pattern, then recall the purpose.`,
    summary: payload?.summary || `A simpler explanation of ${topic} with an analogy and a memory cue.`,
    nextTopic: payload?.nextTopic || `A slightly harder idea connected to ${topic}`
  };
}

function sanitizePodcast(topic, payload) {
  const script = Array.isArray(payload?.script) && payload.script.length
    ? payload.script
    : [
        { speaker: "Host A", line: `Today we're unpacking ${topic} in a practical, learner-friendly way.` },
        { speaker: "Host B", line: `Perfect. Start with the big picture so I know why ${topic} matters.` },
        { speaker: "Host A", line: `${topic} becomes easier when we focus on the core structure before the details.` },
        { speaker: "Host B", line: `So the trick is to understand the pattern first, then build examples from it.` }
      ];

  return {
    title: payload?.title || `${topic} Mini Podcast`,
    takeaway: payload?.takeaway || `A two-host recap designed to make ${topic} easier to remember.`,
    script,
    summary: payload?.summary || `A conversational teaching script about ${topic}.`,
    nextTopic: payload?.nextTopic || `A companion topic that deepens ${topic}`
  };
}

function sanitizeOutput(action, topic, payload) {
  if (action === "study_guide") {
    return sanitizeStudyGuide(topic, payload);
  }

  if (action === "clarify") {
    return sanitizeClarify(topic, payload);
  }

  return sanitizePodcast(topic, payload);
}

function scoreResponse(action, content) {
  const checks = [];

  if (action === "study_guide") {
    checks.push(Boolean(content.overview));
    checks.push(content.keyConcepts.length >= 3);
    checks.push(content.subtopics.length >= 3);
    checks.push(content.practiceQuestions.length >= 3);
    checks.push(content.webResources.length >= 2);
  }

  if (action === "clarify") {
    checks.push(Boolean(content.simpleExplanation));
    checks.push(Boolean(content.analogy));
    checks.push(Boolean(content.memoryHook));
  }

  if (action === "podcast") {
    checks.push(Boolean(content.takeaway));
    checks.push(content.script.length >= 4);
    checks.push(content.script.every((line) => line.speaker && line.line));
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
    return `Score ${score}/100. The guide for ${topic} covered overview, concepts, subtopics, practice prompts, and linked study resources.${memorySignal} Improve next time by linking at least one concept to a previously studied topic even more explicitly.`;
  }

  if (action === "clarify") {
    return `Score ${score}/100. The clarification simplified ${topic}, used an analogy, and added a memory hook.${memorySignal} Improve next time by making the analogy even more concrete.`;
  }

  return `Score ${score}/100. The podcast turned ${topic} into a multi-voice teaching script.${memorySignal} Improve next time by adding a stronger end recap for revision.`;
}

function fallbackGenerate(action, topic, memoryEntries, researchBundle) {
  const recentTopic = memoryEntries[0]?.topic;
  const memoryReference = recentTopic
    ? `You previously studied ${recentTopic}, so this response gently builds on that context.`
    : "This is your first saved study interaction, so the assistant is creating a fresh starting point.";

  if (action === "study_guide") {
    return {
      title: `${topic} Study Guide`,
      overview: `${memoryReference} ${topic} can be learned best by starting with the big idea, then breaking it into the parts, and finally testing yourself with short questions.`,
      keyConcepts: [
        `The core definition of ${topic}`,
        `The main parts, stages, or principles inside ${topic}`,
        `Why ${topic} matters in a real-world setting`,
        `Common misconceptions learners have about ${topic}`
      ],
      subtopics: [
        `Foundational ideas behind ${topic}`,
        `Worked examples involving ${topic}`,
        `How to compare ${topic} with related concepts`,
        `Where ${topic} appears in exams or practice`
      ],
      practiceQuestions: [
        `How would you explain ${topic} in your own words?`,
        `What are the most important parts of ${topic} and why?`,
        `Which real-world example helps you remember ${topic}?`,
        `What question about ${topic} still feels confusing?`
      ],
      webResources: researchBundle.resources,
      summary: `A structured overview of ${topic} with review questions for active recall.`,
      nextTopic: `An intermediate concept that connects naturally after ${topic}`
    };
  }

  if (action === "clarify") {
    return {
      title: `${topic} Explained Simply`,
      simpleExplanation: `${memoryReference} Think of ${topic} as a system with a purpose, a process, and an outcome. Once you identify those three pieces, the idea becomes much easier to hold in memory.`,
      analogy: `${topic} is like learning the rules of a game before playing a full match. Once the rules make sense, the action feels less random and more predictable.`,
      memoryHook: `${topic}: purpose, process, payoff.`,
      summary: `A beginner-friendly explanation of ${topic} with an analogy and recall cue.`,
      nextTopic: `A slightly deeper follow-up concept related to ${topic}`
    };
  }

  return {
    title: `${topic} Mini Podcast`,
    takeaway: `${memoryReference} This script is tuned for quick revision and easy listening.`,
    script: [
      { speaker: "Host A", line: `Welcome back. Today we're making ${topic} feel approachable.` },
      { speaker: "Host B", line: `Great, because I want the simple version before we get fancy.` },
      { speaker: "Host A", line: `${topic} gets easier when you focus on what it does, how it works, and why it matters.` },
      { speaker: "Host B", line: `So if I remember the role, the process, and the payoff, I can rebuild the idea later.` },
      { speaker: "Host A", line: `Exactly. That's what makes this topic easier to recall during revision.` },
      { speaker: "Host B", line: `Perfect. That gives me a short mental script I can replay before a test.` }
    ],
    summary: `A conversational audio-style recap of ${topic}.`,
    nextTopic: `A next-step topic that naturally extends ${topic}`
  };
}

async function generateWithGemini(action, topic, memoryEntries, researchBundle) {
  const client = getClient();
  const memoryContext = buildMemoryContext(memoryEntries);
  const prompt = getUserPrompt(action, topic, buildResearchContext(researchBundle.resources));

  const response = await client.models.generateContent({
    model: getModelName(),
    contents: prompt,
    config: {
      systemInstruction: `${systemPromptBase}

Current memory context:
${memoryContext}`,
      responseMimeType: "application/json"
    }
  });

  return parseJson(response.text);
}

export async function runAgentLoop({ requestedAction, topic, sessionId, memoryEntries }) {
  const action = decideAction(requestedAction, topic);
  const client = getClient();
  const researchBundle =
    action === "study_guide"
      ? await fetchStudyResources(topic)
      : {
          resources: [],
          source: "not_applicable"
        };

  let generated;
  let usedFallback = false;

  if (client) {
    try {
      generated = await generateWithGemini(action, topic, memoryEntries, researchBundle);
    } catch {
      usedFallback = true;
    }
  } else {
    usedFallback = true;
  }

  const content = sanitizeOutput(
    action,
    topic,
    generated || fallbackGenerate(action, topic, memoryEntries, researchBundle)
  );

  if (action === "study_guide" && !content.webResources.length) {
    content.webResources = researchBundle.resources;
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
    resourcesUsed: researchBundle.resources.map((resource) => ({
      title: resource.title,
      url: resource.url,
      source: resource.source
    })),
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
      think: `Built prompt with ${memoryEntries.length} memory entr${memoryEntries.length === 1 ? "y" : "ies"}.`,
      decide: `Selected action "${action}".`,
      act: usedFallback
        ? "Generated a local prototype response because Gemini was unavailable."
        : `Generated with ${getModelName()}.`,
      research:
        action === "study_guide"
          ? `Fetched ${researchBundle.resources.length} study resources via ${researchBundle.source}.`
          : "No external resource fetch needed for this mode.",
      reflect: reflection
    }
  };
}
