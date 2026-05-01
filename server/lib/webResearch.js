function compact(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function truncate(text, max = 250) {
  const clean = compact(text);
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// ─── arXiv ────────────────────────────────────────────────────────────────────

function parseArxivEntries(xml) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

  return entries.slice(0, 3).map((match) => {
    const block = match[1];
    const title = compact(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "arXiv paper");
    const summary = truncate(block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || "");
    const link = block.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "https://arxiv.org";

    return {
      title,
      url: link,
      source: "arXiv",
      type: "article",
      snippet: summary || `Research-oriented reading related to ${title}.`,
      reason: "Academic pre-print with in-depth technical coverage of this topic."
    };
  });
}

async function fetchArxivResources(topic) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(topic)}&start=0&max_results=3&sortBy=relevance&sortOrder=descending`;
  const response = await fetch(url, { headers: { "user-agent": "agentic-study-assistant/1.0" } });

  if (!response.ok) throw new Error(`arXiv search failed: ${response.status}`);

  const xml = await response.text();
  return parseArxivEntries(xml);
}

// ─── YouTube (no API key needed – RSS feed) ───────────────────────────────────

function parseYouTubeRSS(xml) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

  return entries.slice(0, 4).map((match) => {
    const block = match[1];
    const title = compact(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "YouTube video");
    const videoId = block.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/)?.[1]?.trim() || "";
    const author = compact(block.match(/<name>([\s\S]*?)<\/name>/)?.[1] || "YouTube");
    const description = truncate(
      block.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || ""
    );

    return {
      title,
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
      source: author,
      type: "video",
      snippet: description || `Video explanation of ${title}.`,
      reason: "Visual walkthrough that helps clarify this concept step-by-step."
    };
  }).filter((v) => v.url);
}

async function fetchYouTubeVideos(topic) {
  // YouTube RSS search feed – no API key required
  const url = `https://www.youtube.com/feeds/videos.xml?search_query=${encodeURIComponent(`${topic} explained tutorial`)}`;
  const response = await fetch(url, { headers: { "user-agent": "agentic-study-assistant/1.0" } });

  if (!response.ok) throw new Error(`YouTube RSS failed: ${response.status}`);

  const xml = await response.text();
  return parseYouTubeRSS(xml);
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

function buildFallbackArticles(topic) {
  return [
    {
      title: `${topic} on arXiv`,
      url: `https://arxiv.org/search/?query=${encodeURIComponent(topic)}&searchtype=all`,
      source: "arXiv",
      type: "article",
      snippet: `Browse research papers and technical discussions related to ${topic}.`,
      reason: "Good for deeper academic follow-up when live fetch is unavailable."
    },
    {
      title: `${topic} – Google Scholar`,
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(topic)}`,
      source: "Google Scholar",
      type: "article",
      snippet: `Search peer-reviewed publications and academic citations for ${topic}.`,
      reason: "Surfaces high-quality academic sources for this topic."
    }
  ];
}

function buildFallbackVideos(topic) {
  return [
    {
      title: `${topic} – YouTube educational search`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topic} explained`)}`,
      source: "YouTube",
      type: "video",
      snippet: `Search for visual explainers and tutorials about ${topic}.`,
      reason: "Great starting point for visual learners."
    }
  ];
}

// ─── Context builder (injected into LLM prompt) ───────────────────────────────

export function buildArticleContext(articles) {
  if (!articles.length) return "No article resources were fetched.";
  return articles
    .map((r, i) => `${i + 1}. [${r.source}] "${r.title}" — ${r.snippet}\n   URL: ${r.url}`)
    .join("\n\n");
}

export function buildVideoContext(videos) {
  if (!videos.length) return "No video resources were fetched.";
  return videos
    .map((r, i) => `${i + 1}. [${r.source}] "${r.title}" — ${r.snippet}\n   URL: ${r.url}`)
    .join("\n\n");
}

/** Legacy helper used elsewhere in agent.js */
export function buildResearchContext(resources) {
  if (!resources || !resources.length) return "No external study resources were fetched.";
  return resources
    .map((r, i) => `${i + 1}. ${r.title} (${r.source}) — ${r.snippet} URL: ${r.url}`)
    .join("\n");
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchStudyResources(topic) {
  const [articlesResult, videosResult] = await Promise.allSettled([
    fetchArxivResources(topic),
    fetchYouTubeVideos(topic)
  ]);

  const articles =
    articlesResult.status === "fulfilled" && articlesResult.value.length
      ? articlesResult.value
      : buildFallbackArticles(topic);

  const videos =
    videosResult.status === "fulfilled" && videosResult.value.length
      ? videosResult.value
      : buildFallbackVideos(topic);

  const resources = [...articles, ...videos];

  return {
    resources,
    articles,
    videos,
    source: articlesResult.status === "fulfilled" ? "live_web" : "fallback_links"
  };
}
