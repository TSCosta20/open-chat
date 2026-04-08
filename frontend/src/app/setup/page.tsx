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
  return "windows";
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

// ── Shared cloud cards (used on iOS, Android, Windows, Mac) ──────────────────

function CloudCards({ tap = false }: { tap?: boolean }) {
  const click = tap ? "Tap" : "Click";
  return <>
    <Card>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>Option 1 — Free cloud models (recommended)</SectionTitle>
        <div className="flex gap-1.5">
          <Tag color="green">Free</Tag>
          <Tag color="blue">No card needed</Tag>
        </div>
      </div>
      <div className="space-y-3">
        <Step n={1}>
          Open <ExternalLink href="https://openrouter.ai/keys">openrouter.ai/keys</ExternalLink> and
          create a free account — just an email address, no credit card needed.
        </Step>
        <Step n={2}>
          {click} <strong className="text-white">Create key</strong>, give it any name, and copy the key.
          It starts with <code className="bg-black/30 px-1 rounded text-slate-300">sk-or-</code>.
        </Step>
        <Step n={3}>
          Come back to this app, open the model picker (the button showing the current model name at the
          bottom of the screen), go to the <strong className="text-white">Cloud</strong> tab, paste the
          key under <strong className="text-white">OpenRouter key</strong> and {click.toLowerCase()}{" "}
          <strong className="text-white">Save</strong>.
        </Step>
        <Step n={4}>
          Select <strong className="text-white">Best available</strong> and {click.toLowerCase()}{" "}
          <strong className="text-white">Use</strong>. Done — start chatting.
        </Step>
      </div>
    </Card>

    <Card>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>Option 2 — Gemini (Google account)</SectionTitle>
        <Tag color="green">1,500 free requests/day</Tag>
      </div>
      <div className="space-y-3">
        <Step n={1}>
          Open <ExternalLink href="https://aistudio.google.com/app/apikey">aistudio.google.com/app/apikey</ExternalLink> and
          sign in with your Google account.
        </Step>
        <Step n={2}>
          {click} <strong className="text-white">Get API key</strong> →{" "}
          <strong className="text-white">Create API key</strong> and copy it.
        </Step>
        <Step n={3}>
          In the app, open the model picker → <strong className="text-white">Cloud</strong> tab →
          paste under <strong className="text-white">Gemini key</strong> → {click.toLowerCase()}{" "}
          <strong className="text-white">Save</strong>.
        </Step>
        <Step n={4}>
          Select <strong className="text-white">Gemini 2.0 Flash</strong> and {click.toLowerCase()}{" "}
          <strong className="text-white">Use</strong>.
        </Step>
      </div>
    </Card>
  </>;
}

// ── Platform guides ───────────────────────────────────────────────────────────

function IOSGuide() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-300 leading-relaxed">
        On iPhone and iPad, AI runs in the cloud — your message is sent to a server and a reply comes
        back instantly. This is free. Running AI locally is not possible on iOS due to system
        restrictions — cloud is the only option.
      </div>
      <CloudCards tap />
    </div>
  );
}

function AndroidGuide() {
  return (
    <div className="space-y-4">
      <CloudCards tap />

      {/* Termux + Ollama */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 3 — Run AI locally on your phone (Termux + Ollama)</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="purple">Fully private</Tag>
            <Tag color="green">Free</Tag>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300 leading-relaxed space-y-1.5">
          <p>
            <strong className="text-amber-200">Requirements:</strong>{" "}
            Android 7 or newer · at least 6 GB of RAM · 4 GB or more free storage
          </p>
          <p>
            <strong className="text-amber-200">Speed:</strong>{" "}
            Runs on CPU only (phones have no driver support for GPU inference).
            Use small models — anything under 3 billion parameters. Larger models will be very slow.
          </p>
          <p>
            <strong className="text-amber-200">What is Termux?</strong>{" "}
            A free app that gives your Android phone a Linux terminal, allowing it to run software
            normally only available on computers.
          </p>
        </div>

        <div className="space-y-6">

          {/* Part 1 */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Part 1 — Install Termux
            </p>
            <div className="space-y-3">
              <Step n={1}>
                Install F-Droid first — it is a free app store for open-source apps.
                Open <ExternalLink href="https://f-droid.org">f-droid.org</ExternalLink> in
                Chrome on your phone, download the APK file, and install it.
                If Android asks about installing from unknown sources, tap{" "}
                <strong className="text-white">Allow</strong> — this is safe for F-Droid.
              </Step>
              <Step n={2}>
                Open F-Droid, search for <strong className="text-white">Termux</strong>, and
                install it. Do <strong className="text-white">not</strong> use the Play Store version
                of Termux — it is outdated and will not work correctly.
              </Step>
              <Step n={3}>
                Open Termux. You will see a black screen with a blinking cursor — that is normal.
                Update its packages by typing this exactly and pressing Enter:
                <Cmd>pkg update && pkg upgrade -y</Cmd>
                If it asks any questions, type <code className="bg-black/30 px-1 rounded text-slate-300">y</code> and
                press Enter. This takes a few minutes.
              </Step>
            </div>
          </div>

          {/* Part 2 */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Part 2 — Install Ollama
            </p>
            <div className="space-y-3">
              <Step n={4}>
                Run the official Ollama installer — this one command does everything:
                <Cmd>curl -fsSL https://ollama.com/install.sh | sh</Cmd>
                It will download and set up Ollama automatically. This takes a few minutes depending
                on your internet speed.
              </Step>
              <Step n={5}>
                Make Ollama always allow browser connections by running this once:
                <Cmd>{`echo 'export OLLAMA_ORIGINS="*"' >> ~/.bashrc && source ~/.bashrc`}</Cmd>
                You will not need to do this again after this step.
              </Step>
              <Step n={6}>
                Start the Ollama server:
                <Cmd>ollama serve</Cmd>
                Leave this running. Do not close Termux — just press the{" "}
                <strong className="text-white">Home button</strong> to go back to your other apps
                while keeping Termux open in the background.
              </Step>
            </div>
          </div>

          {/* Part 3 */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Part 3 — Download a model
            </p>
            <div className="space-y-3">
              <Step n={7}>
                Open a second Termux session: swipe from the left edge of the Termux screen →
                tap <strong className="text-white">New session</strong>. Then download a model
                suited for phones:
                <Cmd>ollama pull qwen2.5:0.5b</Cmd>
                This is only about 400 MB and is the fastest option. Other choices:
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <div className="flex items-baseline gap-2">
                    <code className="bg-black/30 px-1 rounded text-slate-300 shrink-0">smollm2:360m</code>
                    <span>— smallest (250 MB), fastest, less capable</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <code className="bg-black/30 px-1 rounded text-slate-300 shrink-0">llama3.2:1b</code>
                    <span>— smarter but slower (1.3 GB)</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <code className="bg-black/30 px-1 rounded text-slate-300 shrink-0">llama3.2:3b</code>
                    <span>— best quality that still works on phones (2 GB, needs 6+ GB RAM)</span>
                  </div>
                </div>
              </Step>
              <Step n={8}>
                Press the Home button to go back to this web app (keep Termux open in the background).
                Open the model picker → tap the <strong className="text-white">Ollama</strong> tab →
                tap <strong className="text-white">Retry</strong>. Your model will appear in the list.
                Tap it to select it, then tap <strong className="text-white">Use</strong>.
              </Step>
            </div>
          </div>

          {/* Everyday use */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Part 4 — Everyday use (pick one)
            </p>

            {/* Option A: Manual */}
            <div className="rounded-xl bg-white/5 px-4 py-3 space-y-2 mb-3">
              <p className="text-xs font-semibold text-slate-300">
                Option A — Start manually (recommended, no background impact)
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Whenever you want to use local AI, open Termux, run{" "}
                <code className="bg-black/30 px-1 rounded text-slate-300">ollama serve</code>,
                then press Home and open this app. Ollama only uses CPU and battery while it is
                actively generating a response — when idle it uses almost nothing. When you are done,
                you can close Termux entirely to free up the ~100 MB of memory it holds while waiting.
              </p>
            </div>

            {/* Option B: Auto-start */}
            <div className="rounded-xl bg-white/5 px-4 py-3 space-y-3">
              <p className="text-xs font-semibold text-slate-300">
                Option B — Auto-start on boot (more convenient, small background cost)
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ollama will start automatically every time the phone turns on. The only background
                cost is about 50–100 MB of memory while it waits — CPU and battery are not affected
                until you actually send a message. To set this up:
              </p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold text-slate-300">1</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    In F-Droid, search for <strong className="text-white">Termux:Boot</strong> and install it.
                    Open it once — this registers it with Android so it can run on startup.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold text-slate-300">2</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    In Termux, create the boot script folder and the script itself:
                    <code className="block mt-1.5 rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-emerald-300 select-all leading-relaxed">
                      {`mkdir -p ~/.termux/boot\necho 'ollama serve &' > ~/.termux/boot/start-ollama.sh\nchmod +x ~/.termux/boot/start-ollama.sh`}
                    </code>
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold text-slate-300">3</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Restart your phone. From now on, Ollama starts in the background automatically
                    and this app's <strong className="text-white">Ollama tab</strong> will work
                    straight away without opening Termux first.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold text-slate-300">4</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    If you ever want to stop the auto-start, delete the script:
                    <code className="block mt-1.5 rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-emerald-300 select-all">
                      rm ~/.termux/boot/start-ollama.sh
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </Card>
    </div>
  );
}

function WindowsGuide() {
  return (
    <div className="space-y-4">
      <CloudCards />

      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 3 — Ollama (private, runs on your PC)</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="purple">Fully private</Tag>
            <Tag color="green">Free forever</Tag>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500 leading-relaxed">
          Your messages never leave your computer. Works best with 8 GB RAM or more and
          requires ~4 GB free disk space per model.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Download and install Ollama from{" "}
            <ExternalLink href="https://ollama.com/download/windows">ollama.com/download/windows</ExternalLink>.
            Run the installer like any other Windows app.
          </Step>
          <Step n={2}>
            Open the <strong className="text-white">Start menu</strong>, search for{" "}
            <strong className="text-white">Command Prompt</strong>, and download a model:
            <Cmd>ollama pull llama3.2</Cmd>
            About 2 GB. Browse more models at{" "}
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
            In this app, open the model picker → <strong className="text-white">Ollama tab</strong> →
            click <strong className="text-white">Retry</strong>. Your model will appear. Select it and
            click <strong className="text-white">Use</strong>.
          </Step>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 4 — Runs directly in the browser</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="purple">Fully private</Tag>
            <Tag color="yellow">Needs Chrome / Edge</Tag>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500 leading-relaxed">
          No install needed — models download into your browser the first time (300 MB – 4 GB).
          Requires Chrome 113+ or Edge 113+.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Make sure you are using <ExternalLink href="https://www.google.com/chrome/">Google Chrome</ExternalLink> or{" "}
            <ExternalLink href="https://www.microsoft.com/edge">Microsoft Edge</ExternalLink> (version 113
            or newer — check via the three-dot menu → Help → About).
          </Step>
          <Step n={2}>
            Open the model picker → <strong className="text-white">Transformers.js</strong> tab →
            pick a model tagged <strong className="text-white">fast</strong> (SmolLM2 360M or Qwen 0.5B) →
            click <strong className="text-white">Download &amp; use</strong>.
          </Step>
          <Step n={3}>
            Wait for the download bar to reach 100%. The model is cached and loads instantly from then on.
          </Step>
        </div>
      </Card>
    </div>
  );
}

function MacGuide() {
  return (
    <div className="space-y-4">
      <CloudCards />

      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 3 — Ollama (private, runs on your Mac)</SectionTitle>
          <div className="flex gap-1.5">
            <Tag color="purple">Fully private</Tag>
            <Tag color="green">Free forever</Tag>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500 leading-relaxed">
          Your messages never leave your Mac. Works especially well on Apple Silicon (M1/M2/M3/M4)
          and requires ~4 GB free disk space per model.
        </p>
        <div className="space-y-3">
          <Step n={1}>
            Download Ollama from{" "}
            <ExternalLink href="https://ollama.com/download/mac">ollama.com/download/mac</ExternalLink>.
            Open the downloaded file and drag Ollama to your Applications folder, then open it.
          </Step>
          <Step n={2}>
            Open <strong className="text-white">Terminal</strong> — press{" "}
            <code className="bg-black/30 px-1 rounded text-slate-300">Cmd + Space</code>, type{" "}
            <em>Terminal</em>, press Enter. Then download a model:
            <Cmd>ollama pull llama3.2</Cmd>
            About 2 GB. Browse more at{" "}
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

      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Option 4 — Runs directly in the browser</SectionTitle>
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

  return (
    <div className="min-h-screen bg-surface text-white">
      <div className="mx-auto max-w-2xl px-4 py-10 pb-20">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Get started</h1>
          <p className="mt-1 text-sm text-slate-400">
            Follow the steps for your device. You only need to do this once.
          </p>
        </div>

        {/* Platform selector */}
        <div className="mb-6">
          <p className="mb-2 text-xs text-slate-500 text-center">
            {detected
              ? `Detected: ${PLATFORM_LABELS[detected]} — or pick your device below`
              : "Select your device"}
          </p>
          <div className="flex gap-1 rounded-xl bg-white/5 p-1">
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
        {platform === "ios"     && <IOSGuide />}
        {platform === "android" && <AndroidGuide />}
        {platform === "windows" && <WindowsGuide />}
        {platform === "mac"     && <MacGuide />}

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
