export default function TabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-ink text-white shadow-glow"
          : "bg-white/70 text-ink hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
