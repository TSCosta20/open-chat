export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
        AI
      </div>
      <div className="flex items-center gap-1 rounded-2xl bg-surface-secondary px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-2 w-2 rounded-full bg-slate-400"
            style={{
              animation: "typing 1.2s infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
