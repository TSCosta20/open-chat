"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import clsx from "clsx";
import { detectOS, type OS } from "@/lib/detectOS";

type Platform = "windows" | "mac" | "ios" | "android";

const PLATFORM_LABELS: Record<Platform, string> = {
  windows: "Windows",
  mac:     "Mac",
  ios:     "iPhone / iPad",
  android: "Android",
};

function osToPlatform(os: OS): Platform {
  if (os === "ios")     return "ios";
  if (os === "android") return "android";
  if (os === "mac")     return "mac";
  return "windows"; // default for windows, linux, unknown
}

// ── Shared primitives ────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-2xl border border-surface-border bg-surface-secondary p-5", className)}>
      {children}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
        {n}
      </span>
      <p className="text-sm text-slate-300 leading-relaxed">{children}</p>
    </div>
  );
}

function Cmd({ children }: { children: string }) {
  return (
    <code className="block my-2 rounded-lg bg-black/40 px-4 py-2.5 font-mono text-xs text-emerald-300 select-all">
      {children}
    </code>
  );
}

function Tag({ children, color = "blue" }: { children: React.ReactNode; color?: "green" | "blue" | "yellow" | "purple" }) {
  const colors = {
    green:  "bg-emerald-500/15 text-emerald-400",
    blue:   "bg-blue-500/15 text-blue-400",
    yellow: "bg-yellow-500/15 text-yellow-400",
    purple: "bg-purple-500/15 text-purple-400",
  };
  return (
    <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", colors[color])}>
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold text-white">{children}</h3>;
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-hover">
      {children}
    </a>
  );
}

// ── Platform content ─────────────────────────────────────────────────────────

function MobileGuide() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400 leading-relaxed">
        On mobile, AI runs in the cloud — your phone sends your message to a server which replies instantly.
        It is free and no special apps are needed.
      </p>

      {/* Option 1: OpenRouter */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 1 — Free cloud models (recommended)</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="green">Free</Tag>
            <Tag color="blue">No card</Tag>
          </div>
        </div>
        <div className="space-y-3">
          <Step n={1}>
            Open <ExternalLink href="https://openrouter.ai/keys">openrouter.ai/keys</ExternalLink> in
            your browser and create a free account (email only, no credit card needed).
          </Step>
          <Step n={2}>
            Tap <strong className="text-white">Create key</strong>, give it any name, and copy the key
            that starts with <code className="bg-black/30 px-1 rounded text-slate-300">sk-or-</code>.
          </Step>
          <Step n={3}>
            Come back to this app, tap the model picker, go to the{" "}
            <strong className="text-white">Cloud</strong> tab, paste the key under{" "}
            <strong className="text-white">OpenRouter key</strong> and tap <strong className="text-white">Save</strong>.
          </Step>
          <Step n={4}>
            Select <strong className="text-white">Best available</strong> and tap{" "}
            <strong className="text-white">Use</strong>. Done — start chatting.
          </Step>
        </div>
      </Card>

      {/* Option 2: Gemini */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 2 — Gemini (Google account)</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="green">1,500 req/day free</Tag>
          </div>
        </div>
        <div className="space-y-3">
          <Step n={1}>
            Open <ExternalLink href="https://aistudio.google.com/app/apikey">aistudio.google.com/app/apikey</ExternalLink> and
            sign in with your Google account.
          </Step>
          <Step n={2}>
            Tap <strong className="text-white">Get API key</strong> →{" "}
            <strong className="text-white">Create API key</strong> and copy it.
          </Step>
          <Step n={3}>
            In the app, go to the <strong className="text-white">Cloud</strong> tab, paste under{" "}
            <strong className="text-white">Gemini key</strong> → Save.
          </Step>
          <Step n={4}>
            Select <strong className="text-white">Gemini 2.0 Flash</strong> and tap{" "}
            <strong className="text-white">Use</strong>.
          </Step>
        </div>
      </Card>
    </div>
  );
}

function WindowsGuide() {
  return (
    <div className="space-y-4">
      {/* Option 1: Cloud */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 1 — Free cloud models (easiest)</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="green">No install</Tag>
            <Tag color="blue">Free</Tag>
          </div>
        </div>
        <div className="space-y-3">
          <Step n={1}>
            Go to <ExternalLink href="https://openrouter.ai/keys">openrouter.ai/keys</ExternalLink> and
            create a free account (just an email, no credit card).
          </Step>
          <Step n={2}>
            Click <strong className="text-white">Create key</strong>, give it any name, copy the key
            (starts with <code className="bg-black/30 px-1 rounded text-slate-300">sk-or-</code>).
          </Step>
          <Step n={3}>
            In this app, open the model picker → <strong className="text-white">Cloud tab</strong> →
            paste the key under <strong className="text-white">OpenRouter key</strong> → Save.
          </Step>
          <Step n={4}>
            Select <strong className="text-white">Best available</strong> → click{" "}
            <strong className="text-white">Use</strong>. Done.
          </Step>
        </div>
      </Card>

      {/* Option 2: Ollama */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 2 — Ollama (private, runs on your PC)</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="purple">Fully private</Tag>
            <Tag color="green">Free forever</Tag>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500 leading-relaxed">
          Your messages never leave your computer. Requires ~4 GB of free disk space per model and works best
          with 8 GB RAM or more.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Download and install Ollama from{" "}
            <ExternalLink href="https://ollama.com/download/windows">ollama.com/download/windows</ExternalLink>.
            Run the installer like any other Windows app.
          </Step>
          <Step n={2}>
            Open the <strong className="text-white">Start menu</strong>, search for{" "}
            <strong className="text-white">Command Prompt</strong>, and run this command to download a model:
            <Cmd>ollama pull llama3.2</Cmd>
            This downloads about 2 GB. You can browse more models at{" "}
            <ExternalLink href="https://ollama.com/library">ollama.com/library</ExternalLink>.
          </Step>
          <Step n={3}>
            <strong className="text-white">Allow the browser to reach Ollama</strong> (one-time setup):
            <br />
            Press <code className="bg-black/30 px-1 rounded text-slate-300">Windows + R</code>, type{" "}
            <code className="bg-black/30 px-1 rounded text-slate-300">sysdm.cpl</code>, press Enter →
            go to the <strong className="text-white">Advanced</strong> tab →{" "}
            <strong className="text-white">Environment Variables</strong> →
            under <em>User variables</em> click <strong className="text-white">New</strong>:
            <div className="mt-2 rounded-lg bg-black/40 p-3 font-mono text-xs text-slate-300 space-y-1">
              <div>Variable name: <span className="text-emerald-300">OLLAMA_ORIGINS</span></div>
              <div>Variable value: <span className="text-emerald-300">*</span></div>
            </div>
            Click OK on all windows. Then right-click the Ollama icon in the bottom-right system tray →
            <strong className="text-white"> Quit</strong>, and reopen Ollama from the Start menu.
          </Step>
          <Step n={4}>
            Back in this app, open the model picker → <strong className="text-white">Ollama tab</strong> →
            click <strong className="text-white">Retry</strong>. Your model will appear. Select it and click{" "}
            <strong className="text-white">Use</strong>.
          </Step>
        </div>
      </Card>

      {/* Option 3: Browser */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 3 — Runs directly in the browser</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="purple">Fully private</Tag>
            <Tag color="yellow">Needs Chrome / Edge</Tag>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500 leading-relaxed">
          No install needed — models download into your browser the first time (300 MB – 4 GB depending on the model).
          Requires Chrome 113+ or Edge 113+.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Make sure you are using <ExternalLink href="https://www.google.com/chrome/">Google Chrome</ExternalLink> or{" "}
            <ExternalLink href="https://www.microsoft.com/edge">Microsoft Edge</ExternalLink> (version 113 or newer —
            check via the three-dot menu → Help → About).
          </Step>
          <Step n={2}>
            In this app, open the model picker and go to the{" "}
            <strong className="text-white">Transformers.js</strong> tab.
          </Step>
          <Step n={3}>
            Pick a model tagged <strong className="text-white">fast</strong> (such as SmolLM2 360M or Qwen 0.5B)
            for the quickest first download, then click <strong className="text-white">Download &amp; use</strong>.
          </Step>
          <Step n={4}>
            Wait for the download bar to reach 100%. After that, the model is cached and loads instantly next time.
          </Step>
        </div>
      </Card>
    </div>
  );
}

function MacGuide() {
  return (
    <div className="space-y-4">
      {/* Option 1: Cloud */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 1 — Free cloud models (easiest)</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="green">No install</Tag>
            <Tag color="blue">Free</Tag>
          </div>
        </div>
        <div className="space-y-3">
          <Step n={1}>
            Go to <ExternalLink href="https://openrouter.ai/keys">openrouter.ai/keys</ExternalLink> and
            create a free account (just email, no credit card).
          </Step>
          <Step n={2}>
            Click <strong className="text-white">Create key</strong>, copy the key
            (starts with <code className="bg-black/30 px-1 rounded text-slate-300">sk-or-</code>).
          </Step>
          <Step n={3}>
            In this app, open the model picker → <strong className="text-white">Cloud tab</strong> →
            paste the key under <strong className="text-white">OpenRouter key</strong> → Save.
          </Step>
          <Step n={4}>
            Select <strong className="text-white">Best available</strong> → click{" "}
            <strong className="text-white">Use</strong>. Done.
          </Step>
        </div>
      </Card>

      {/* Option 2: Ollama */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 2 — Ollama (private, runs on your Mac)</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="purple">Fully private</Tag>
            <Tag color="green">Free forever</Tag>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500 leading-relaxed">
          Your messages never leave your Mac. Works great on Apple Silicon (M1/M2/M3/M4) and
          requires ~4 GB free disk space per model.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Download Ollama from{" "}
            <ExternalLink href="https://ollama.com/download/mac">ollama.com/download/mac</ExternalLink>.
            Open the downloaded file and drag Ollama to your Applications folder.
          </Step>
          <Step n={2}>
            Open <strong className="text-white">Terminal</strong> (search with Spotlight: press{" "}
            <code className="bg-black/30 px-1 rounded text-slate-300">Cmd + Space</code>, type{" "}
            <em>Terminal</em>) and run:
            <Cmd>ollama pull llama3.2</Cmd>
            This downloads about 2 GB. Browse more at{" "}
            <ExternalLink href="https://ollama.com/library">ollama.com/library</ExternalLink>.
          </Step>
          <Step n={3}>
            Back in this app, open the model picker → <strong className="text-white">Ollama tab</strong> →
            your model will appear automatically. Select it and click{" "}
            <strong className="text-white">Use</strong>.
          </Step>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          On Mac, Ollama already allows requests from localhost — no extra configuration needed.
        </p>
      </Card>

      {/* Option 3: Browser */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 3 — Runs directly in the browser</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="purple">Fully private</Tag>
            <Tag color="yellow">Needs Chrome / Edge</Tag>
          </div>
        </div>
        <div className="space-y-3">
          <Step n={1}>
            Use <ExternalLink href="https://www.google.com/chrome/">Google Chrome</ExternalLink> or{" "}
            <ExternalLink href="https://www.microsoft.com/edge">Microsoft Edge</ExternalLink> version 113+.
          </Step>
          <Step n={2}>
            Open the model picker → <strong className="text-white">Transformers.js</strong> tab →
            pick a model tagged <strong className="text-white">fast</strong> →
            click <strong className="text-white">Download &amp; use</strong>.
          </Step>
          <Step n={3}>
            Wait for the download bar to finish. The model is cached after the first download.
          </Step>
        </div>
      </Card>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [platform, setPlatform] = useState<Platform>("windows");
  const [detected, setDetected]  = useState<Platform | null>(null);

  useEffect(() => {
    const p = osToPlatform(detectOS());
    setPlatform(p);
    setDetected(p);
  }, []);

  const isMobile = platform === "ios" || platform === "android";

  return (
    <div className="min-h-screen bg-surface text-white">
      <div className="mx-auto max-w-2xl px-4 py-10 pb-20">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Get started</h1>
          <p className="mt-1 text-sm text-slate-400">
            Follow the steps for your device below. You only need to do this once.
          </p>
        </div>

        {/* Platform selector */}
        <div className="mb-6">
          <p className="mb-2 text-xs text-slate-500 text-center">
            {detected
              ? `Detected: ${PLATFORM_LABELS[detected]} — or pick your device below`
              : "Select your device"}
          </p>
          <div className="flex gap-2 rounded-xl bg-white/5 p-1">
            {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={clsx(
                  "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
                  platform === p
                    ? "bg-accent text-white shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isMobile  ? <MobileGuide /> : null}
        {platform === "windows" ? <WindowsGuide /> : null}
        {platform === "mac"     ? <MacGuide /> : null}

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/chat"
            className="w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            Go to chat
          </Link>
          <p className="text-xs text-slate-600">
            You can always come back to this page from the sidebar.
          </p>
        </div>

      </div>
    </div>
  );
}
