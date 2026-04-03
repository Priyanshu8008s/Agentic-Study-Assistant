import { useState } from "react";

export default function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-3xl border border-ink/10 bg-white/80 shadow-glow backdrop-blur">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-lg font-semibold text-ink">{title}</span>
        <span className="text-sm font-medium text-ink/60">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? <div className="border-t border-ink/10 px-5 py-4">{children}</div> : null}
    </section>
  );
}
