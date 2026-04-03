import CollapsibleSection from "./CollapsibleSection";

function BulletList({ items }) {
  return (
    <ul className="space-y-2 text-sm text-ink/80">
      {items.map((item) => (
        <li key={item} className="rounded-2xl bg-mist/70 px-4 py-3">
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
          <CollapsibleSection title="Overview">
            <p className="text-sm leading-7 text-ink/80">{content.overview}</p>
          </CollapsibleSection>
          <CollapsibleSection title="Key Concepts">
            <BulletList items={content.keyConcepts} />
          </CollapsibleSection>
          <CollapsibleSection title="Subtopics">
            <BulletList items={content.subtopics} />
          </CollapsibleSection>
          <CollapsibleSection title="Practice Questions">
            <BulletList items={content.practiceQuestions} />
          </CollapsibleSection>
          <CollapsibleSection title="Study Resources">
            <ResourceList items={content.webResources || []} />
          </CollapsibleSection>
        </div>
      ) : null}

      {action === "clarify" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[2rem] bg-white/80 p-5 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">Simple Explanation</p>
            <p className="mt-4 text-sm leading-7 text-ink/80">{content.simpleExplanation}</p>
          </div>
          <div className="rounded-[2rem] bg-white/80 p-5 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">Real-World Analogy</p>
            <p className="mt-4 text-sm leading-7 text-ink/80">{content.analogy}</p>
          </div>
          <div className="rounded-[2rem] bg-white/80 p-5 shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/50">Memory Hook</p>
            <p className="mt-4 text-sm leading-7 text-ink/80">{content.memoryHook}</p>
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
    </div>
  );
}
