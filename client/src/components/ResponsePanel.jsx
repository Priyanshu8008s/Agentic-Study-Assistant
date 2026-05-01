import CollapsibleSection from "./CollapsibleSection";
import ReactMarkdown from "react-markdown";

function BulletList({ items }) {
  if (!items || !items.length) return null;
  return (
    <ul className="space-y-2 text-sm text-ink/80">
      {items.map((item, idx) => (
        <li key={idx} className="rounded-2xl bg-mist/70 px-4 py-3">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ResourceList({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <a
          key={item.url}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-2xl border border-ink/10 bg-white px-4 py-4 transition hover:border-pine/40 hover:bg-mist/50"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{item.title}</span>
            <span className="rounded-full bg-sand px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/70">
              {item.source}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink/72">{item.snippet}</p>
          <p className="mt-2 text-xs font-medium text-pine">{item.reason}</p>
        </a>
      ))}
    </div>
  );
}

function PodcastPlayer({ lines }) {
  function handlePlay() {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const script = lines
      .map((line) => `${line.speaker === "Host A" ? "Host A says" : "Host B says"} ${line.line}`)
      .join(". ");

    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.96;
    utterance.pitch = 1.02;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={handlePlay}
      className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white transition hover:bg-pine/90"
    >
      Play podcast
    </button>
  );
}

export default function ResponsePanel({ response }) {
  if (!response) {
    return (
      <div className="rounded-[2rem] border border-dashed border-ink/15 bg-white/55 p-8 text-ink/55">
        The agent loop output will appear here after the first run.
      </div>
    );
  }

  const { action, content } = response;

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-ink/10 bg-white/75 p-5 shadow-glow backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink/45">Agent loop result</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{content.title || response.topic}</h2>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-mist px-3 py-2 font-semibold text-ink">
              Quality score: {response.reflectionScore}/100
            </span>
            <span className="rounded-full bg-sand px-3 py-2 font-semibold text-ink">
              Next topic: {response.nextTopic}
            </span>
          </div>
        </div>

        <p className="mt-4 rounded-2xl bg-ink px-4 py-3 text-sm text-white">
          Reflection: {response.reflection}
        </p>
      </div>

      {action === "study_guide" ? (
        <div className="space-y-4">
          <div className="rounded-[2rem] bg-white/80 p-6 shadow-glow">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-pine">Masterclass Lesson</p>
            <div className="prose prose-sm max-w-none text-ink/80 prose-headings:text-ink prose-strong:text-ink prose-bullet:text-pine">
              <ReactMarkdown>{content.lesson}</ReactMarkdown>
            </div>
          </div>

          <CollapsibleSection title="Engaging Activities">
            <BulletList items={content.activities} />
          </CollapsibleSection>

          {content.articles && content.articles.length > 0 && (
            <CollapsibleSection title="📚 Deep Dive Reading">
              <div className="space-y-3">
                {content.articles.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-ink/10 bg-white px-4 py-4 transition hover:border-pine/40 hover:bg-mist/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{item.title}</span>
                      <span className="rounded-full bg-sand px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/70">
                        {item.source}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/72">{item.snippet}</p>
                    <p className="mt-2 text-xs font-medium text-pine">{item.reason}</p>
                  </a>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {content.videos && content.videos.length > 0 && (
            <CollapsibleSection title="🎥 Watch & Learn">
              <div className="space-y-3">
                {content.videos.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-4 rounded-2xl border border-ink/10 bg-white px-4 py-4 transition hover:border-ember/40 hover:bg-sand/30"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ember/10 text-lg">
                      ▶
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-1 text-xs text-ink/55">{item.source}</p>
                      <p className="mt-2 text-sm leading-6 text-ink/72">{item.snippet}</p>
                      <p className="mt-2 text-xs font-medium text-ember">{item.reason}</p>
                    </div>
                  </a>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      ) : null}

      {action === "clarify" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[2rem] bg-white/80 p-5 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">Technical Definition</p>
            <p className="mt-4 text-sm leading-7 text-ink/80">{content.technicalDefinition}</p>
          </div>
          <div className="rounded-[2rem] bg-white/80 p-5 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">Core Components</p>
            <p className="mt-4 text-sm leading-7 text-ink/80">{content.coreComponents}</p>
          </div>
          <div className="rounded-[2rem] bg-white/80 p-5 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/50">Advanced Implications</p>
            <p className="mt-4 text-sm leading-7 text-ink/80">{content.advancedImplications}</p>
          </div>
        </div>
      ) : null}

      {action === "podcast" ? (
        <div className="rounded-[2rem] border border-ink/10 bg-white/80 p-5 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">Two-host script</p>
              <p className="mt-2 text-sm text-ink/70">{content.takeaway}</p>
            </div>
            <PodcastPlayer lines={content.script} />
          </div>

          <div className="mt-6 space-y-3">
            {content.script.map((line, index) => (
              <div
                key={`${line.speaker}-${index}`}
                className={`rounded-2xl px-4 py-3 text-sm leading-7 ${
                  line.speaker === "Host A" ? "bg-horizon/70" : "bg-sand/70"
                }`}
              >
                <span className="font-semibold text-ink">{line.speaker}:</span> {line.line}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {action === "teach" ? (
        <div className="space-y-4">
          <div className="rounded-[2rem] bg-white/80 p-6 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">Tutor Explanation</p>
            <p className="mt-4 text-sm leading-7 text-ink/80">{content.explanation}</p>
          </div>
          {content.bulletPoints && content.bulletPoints.length > 0 && (
            <CollapsibleSection title="Key Takeaways">
              <BulletList items={content.bulletPoints} />
            </CollapsibleSection>
          )}
        </div>
      ) : null}
    </div>
  );
}
