export default function InitiativeBanner({ initiative, onReuseTopic }) {
  if (!initiative) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-ember/20 bg-white/75 p-5 shadow-glow backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ember">
            Autonomous Initiative
          </p>
          <p className="text-lg font-semibold text-ink">{initiative.message}</p>
          <p className="text-sm text-ink/70">
            Suggested next step: <span className="font-semibold text-pine">{initiative.nextTopic}</span>
          </p>
        </div>

        {initiative.recapSuggestion?.topic ? (
          <button
            type="button"
            onClick={() => onReuseTopic(initiative.recapSuggestion.topic)}
            className="rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white transition hover:bg-ember/90"
          >
            Review {initiative.recapSuggestion.topic}
          </button>
        ) : null}
      </div>
    </div>
  );
}
