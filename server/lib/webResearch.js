function compact(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function truncate(text, max = 220) {
  const clean = compact(text);
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function normalizeWikipediaResult(item) {
  return {
    title: item.title,
    url: item.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
    source: "Wikipedia",
    type: "encyclopedia",
    snippet: truncate(item.description || item.extract || `Overview article about ${item.title}.`),
    reason: "Good starting point for high-level understanding."
  };
}

function parseArxivEntries(xml) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

  return entries.slice(0, 2).map((match) => {
    const block = match[1];
    const title = compact(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "arXiv paper");
    const summary = truncate(block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || "");
    const link = block.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "https://arxiv.org";

    return {
      title,
      url: link,
      source: "arXiv",
      type: "paper",
      snippet: summary || `Research-oriented reading related to ${title}.`,
      reason: "Useful if you want a deeper technical source after the basics."
    };
  });
}

async function fetchWikipediaResources(topic) {
  const url = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(topic)}&limit=3`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "agentic-study-assistant/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Wikipedia search failed with status ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.pages) ? payload.pages.map(normalizeWikipediaResult) : [];
}

async function fetchArxivResources(topic) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(topic)}&start=0&max_results=2&sortBy=relevance&sortOrder=descending`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "agentic-study-assistant/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`arXiv search failed with status ${response.status}`);
  }

  const xml = await response.text();
  return parseArxivEntries(xml);
}

function buildFallbackResources(topic) {
  return [
    {
      title: `${topic} on Wikipedia`,
      url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(topic)}`,
      source: "Wikipedia",
      type: "encyclopedia",
      snippet: `Search Wikipedia for a broad overview of ${topic}.`,
      reason: "Strong starting point when live web lookup is unavailable."
    },
    {
      title: `${topic} on arXiv`,
      url: `https://arxiv.org/search/?query=${encodeURIComponent(topic)}&searchtype=all`,
      source: "arXiv",
      type: "paper",
      snippet: `Browse research papers and technical discussions related to ${topic}.`,
      reason: "Good for deeper academic follow-up."
    },
    {
      title: `${topic} study search`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`${topic} study guide`)}`,
      source: "Web search",
      type: "search",
      snippet: `Search broadly for tutorials, explainers, and examples about ${topic}.`,
      reason: "Useful backup path for finding videos, notes, and practice resources."
    }
  ];
}

function dedupeResources(resources) {
  const seen = new Set();

  return resources.filter((resource) => {
    const key = resource.url;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function buildResearchContext(resources) {
  if (!resources.length) {
    return "No external study resources were fetched.";
  }

  return resources
    .map(
      (resource, index) =>
        `${index + 1}. ${resource.title} (${resource.source}) - ${resource.snippet} URL: ${resource.url}`
    )
    .join("\n");
}

export async function fetchStudyResources(topic) {
  const settled = await Promise.allSettled([
    fetchWikipediaResources(topic),
    fetchArxivResources(topic)
  ]);

  const liveResources = settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  const resources = dedupeResources(
    liveResources.length ? liveResources : buildFallbackResources(topic)
  ).slice(0, 5);

  return {
    resources,
    source: liveResources.length ? "live_web" : "fallback_links"
  };
}
