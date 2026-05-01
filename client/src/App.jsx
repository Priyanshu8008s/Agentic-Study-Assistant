import { useEffect, useState } from "react";
import MemorySidebar from "./components/MemorySidebar";
import ResponsePanel from "./components/ResponsePanel";
import TabButton from "./components/TabButton";
import { fetchMemory, runAgent } from "./lib/api";
import CourseOutline from "./components/CourseOutline";

const tabs = [
  {
    id: "study_guide",
    label: "Study Guide",
    placeholder: "Ask a question or request a topic explanation based on the uploaded PDF..."
  },
  {
    id: "clarify",
    label: "Concepts",
    placeholder: ""
  }
];

function getSessionId() {
  const key = "agentic-study-session";
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const created = window.crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("study_guide");
  const [inputs, setInputs] = useState({
    study_guide: "",
    clarify: ""
  });
  const [sessionId] = useState(getSessionId);
  const [response, setResponse] = useState(null);
  const [memory, setMemory] = useState([]);
  const [outline, setOutline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");

  async function loadSideData() {
    const memoryPayload = await fetchMemory(sessionId);
    setMemory(memoryPayload.entries);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const memoryPayload = await fetchMemory(sessionId);

        if (cancelled) {
          return;
        }

        setMemory(memoryPayload.entries);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [sessionId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const topic = inputs[activeTab].trim();

      if (!topic) {
        throw new Error("Please enter a topic first.");
      }

      const payload = await runAgent({
        action: activeTab,
        topic,
        sessionId
      });

      setResponse(payload);
      await loadSideData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }


  function updateInput(value) {
    setInputs((current) => ({
      ...current,
      [activeTab]: value
    }));
  }


  const activeConfig = tabs.find((tab) => tab.id === activeTab);
  const nextTopic = response?.nextTopic;

  return (
    <div className="hero-grid min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.4fr_0.7fr]">
        <main className="space-y-6">
          <section className="rounded-[2.5rem] border border-ink/10 bg-white/70 p-6 shadow-glow backdrop-blur sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-ember">
                  Agentic Study Assistant
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                  A study app that observes, thinks, decides, acts, reflects, and improves.
                </h1>
              </div>

              <div className="rounded-[2rem] bg-ink px-5 py-4 text-white">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Session ID</p>
                <p className="mt-2 text-sm font-medium">{sessionId}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-glow backdrop-blur">
            <div className="flex flex-wrap gap-3">
              {tabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  active={tab.id === activeTab}
                  label={tab.label}
                  onClick={() => setActiveTab(tab.id)}
                />
              ))}
            </div>

            {activeTab === "clarify" ? (
              <div className="mt-6">
                {outline ? (
                  <CourseOutline 
                    outline={outline} 
                    onTopicSelect={(topic) => {
                      updateInput(topic);
                      setActiveTab("study_guide");
                    }} 
                  />
                ) : (
                  <p className="text-sm text-ink/60 p-4 border border-dashed border-ink/20 rounded-2xl">
                    Upload a PDF document first to view the extracted course outline here.
                  </p>
                )}
              </div>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-ink/75">
                    Ask about your document
                  </span>
                  <textarea
                    value={inputs[activeTab]}
                    onChange={(event) => updateInput(event.target.value)}
                    placeholder={activeConfig.placeholder}
                    rows={4}
                    className="w-full rounded-[1.75rem] border border-ink/10 bg-white px-5 py-4 text-sm text-ink outline-none ring-0 transition placeholder:text-ink/35 focus:border-pine"
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    disabled={loading || booting}
                    className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/92 disabled:cursor-not-allowed disabled:bg-ink/40"
                  >
                    {loading ? "Asking Tutor..." : "Ask Tutor"}
                  </button>

                  <p className="text-sm text-ink/60">
                    Active mode: <span className="font-semibold text-pine">{activeConfig.label}</span>
                  </p>
                </div>

                {error ? <p className="text-sm font-medium text-ember">{error}</p> : null}
              </form>
            )}
          </section>

          <ResponsePanel response={response} />
        </main>

        <MemorySidebar 
          entries={memory} 
          nextTopic={nextTopic} 
          outline={outline}
          onUploadComplete={setOutline}
          loading={loading}
        />
      </div>
    </div>
  );
}
