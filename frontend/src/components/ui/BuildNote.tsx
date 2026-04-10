"use client";

import { useMemo } from "react";

function shortSha(sha: string) {
  const s = (sha ?? "").trim();
  return s ? s.slice(0, 7) : "";
}

export function BuildNote() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
  const time = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";
  const env = process.env.NEXT_PUBLIC_BUILD_ENV ?? "";

  const label = useMemo(() => {
    const s = shortSha(sha);
    if (s) return `build ${s}`;
    if (env) return `build ${env}`;
    return "build dev";
  }, [sha, env]);

  const title = useMemo(() => {
    const parts = [
      sha ? `sha: ${sha}` : null,
      time ? `built: ${time}` : null,
      env ? `env: ${env}` : null,
    ].filter(Boolean);
    return parts.join("\n") || "Build info";
  }, [sha, time, env]);

  return (
    <div className="fixed bottom-2 right-2 z-50 pointer-events-none">
      <div
        className="pointer-events-auto select-text rounded-md bg-black/30 px-2 py-1 text-[10px] text-slate-400 backdrop-blur border border-white/5"
        title={title}
      >
        {label}
      </div>
    </div>
  );
}

