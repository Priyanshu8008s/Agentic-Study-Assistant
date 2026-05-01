import { useState } from "react";

export default function CourseOutline({ outline, onTopicSelect }) {
  const [expandedTopics, setExpandedTopics] = useState({});

  if (!outline || !outline.topics || outline.topics.length === 0) return null;

  const toggleTopic = (index) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="mt-6 rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-glow backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold text-ink">Course Outline</h2>
      <p className="mb-4 text-sm text-ink/70">
        Extracted from your uploaded document. Click to request a tutor session.
      </p>

      <div className="space-y-3">
        {outline.topics.map((topicItem, idx) => {
          // Flexible handling depending on Gemini JSON output
          const topicName = typeof topicItem === "string" ? topicItem : topicItem.name || topicItem.topic || `Topic ${idx + 1}`;
          const subtopics = topicItem.subtopics || [];

          return (
            <div key={idx} className="rounded-xl border border-ink/5 bg-white p-3">
              <div
                className="flex cursor-pointer items-center justify-between"
                onClick={() => subtopics.length ? toggleTopic(idx) : onTopicSelect(topicName)}
              >
                <div className="flex items-center gap-2">
                  {subtopics.length > 0 && (
                    <span className="text-pine/70">
                      {expandedTopics[idx] ? "▼" : "▶"}
                    </span>
                  )}
                  <span className="font-semibold text-ink" onClick={(e) => {
                    e.stopPropagation();
                    onTopicSelect(topicName);
                  }}>{topicName}</span>
                </div>
              </div>

              {expandedTopics[idx] && subtopics.length > 0 && (
                <ul className="mt-2 ml-6 space-y-2 border-l border-ink/10 pl-4">
                  {subtopics.map((sub, subIdx) => {
                    const subName = typeof sub === "string" ? sub : sub.name || sub.title || `Subtopic ${subIdx + 1}`;
                    return (
                      <li
                        key={subIdx}
                        className="cursor-pointer text-sm text-ink/70 transition-colors hover:text-pine"
                        onClick={() => onTopicSelect(subName)}
                      >
                        • {subName}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
