import { useState } from "react";
import DocumentUpload from "./DocumentUpload";

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function MemorySidebar({ entries, nextTopic, outline, onUploadComplete, loading }) {
  return (
    <aside className="space-y-6">
      <DocumentUpload onUploadComplete={onUploadComplete} />
      
      <div className="rounded-[2rem] border border-ink/10 bg-white/75 p-5 shadow-glow backdrop-blur space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pine">Memory</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Session history</h2>
        </div>

        <div className="rounded-2xl bg-mist p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Session counter</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{entries.length}</p>
        </div>

        <div className="rounded-2xl bg-sand/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">What to study next</p>
          <p className="mt-2 text-sm font-medium text-ink">{nextTopic || "Your next suggestion will appear here."}</p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Past topics</p>

          <div className="soft-scroll max-h-[28rem] space-y-3 overflow-y-auto pr-2">
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/15 p-4 text-sm text-ink/60">
                No memory yet. Ask for a guide, clarification, or podcast to start the loop.
              </div>
            ) : null}

            {entries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{entry.topic}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">
                      {entry.type.replace("_", " ")}
                    </p>
                  </div>
                  <span className="text-xs text-ink/50">{formatTime(entry.timestamp)}</span>
                </div>

                <p className="mt-3 text-sm text-ink/70">{entry.summary}</p>
                <p className="mt-3 text-xs text-pine">Reflection: {entry.reflection}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
