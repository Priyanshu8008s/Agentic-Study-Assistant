import { useState, useEffect } from "react";

export default function TutorInput({ selectedTopic, onSubmit, loading }) {
  const [input, setInput] = useState("");

  useEffect(() => {
    if (selectedTopic) {
      setInput(selectedTopic);
    }
  }, [selectedTopic]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
    }
  };

  return (
    <div className="mt-6 rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-glow backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold text-ink">Grounded Tutor</h2>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink/75">
            What would you like me to teach you based on the document?
          </span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a topic from above, or ask a question..."
            rows={3}
            className="w-full rounded-[1.75rem] border border-ink/10 bg-white px-5 py-4 text-sm text-ink outline-none ring-0 transition placeholder:text-ink/35 focus:border-pine"
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-pine/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Teaching..." : "Teach me"}
          </button>
        </div>
      </form>
    </div>
  );
}
