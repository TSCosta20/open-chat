"use client";

import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import { useChatStore } from "@/store/useChatStore";
import type { Message } from "@/types";

// Shared markdown styles for assistant bubbles
function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          return isBlock ? (
            <code className="block rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-slate-200 my-2 overflow-x-auto whitespace-pre">
              {children}
            </code>
          ) : (
            <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs text-slate-200">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        h1: ({ children }) => (
          <h1 className="mb-2 text-base font-bold text-white">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 text-sm font-bold text-white">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 text-sm font-semibold text-slate-200">{children}</h3>
        ),
        hr: () => <hr className="my-3 border-slate-600" />,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-slate-500 pl-3 text-slate-400 italic">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const meta = useChatStore((s) => s.messageMeta[message.id] ?? null);

  if (message.content === "__SUGGEST_LOCAL__")    return <SuggestLocalBubble />;
  if (message.content === "__TOO_HEAVY__")        return <TooHeavyBubble />;
  if (message.content === "__SWITCHED_TO_CLOUD__") return <SwitchedToCloudBubble />;

  return (
    <div
      className={clsx(
        "flex items-start gap-3 px-4 py-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          isUser ? "bg-accent text-white" : "bg-slate-600 text-slate-300"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div className={clsx("max-w-[75%] flex flex-col", isUser && "items-end")}>
        {!isUser && meta?.label && (
          <div
            className="mb-1 px-1 text-[10px] text-slate-500"
            title={meta.provider ? `${meta.label} (${meta.provider})` : meta.label}
          >
            via {meta.label}
          </div>
        )}
        <div
          className={clsx(
            "rounded-2xl px-4 py-3 text-sm",
            isUser
              ? "rounded-tr-sm bg-accent text-white"
              : "rounded-tl-sm bg-surface-secondary text-slate-100"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          ) : (
            <Markdown content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}

interface StreamingBubbleProps {
  content: string;
}

function TooHeavyBubble() {
  const setModelReady      = useChatStore((s) => s.setModelReady);
  const setPickerLocalOnly = useChatStore((s) => s.setPickerLocalOnly);

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-slate-300">
        AI
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 space-y-3">
        <p className="font-semibold">This model is too heavy for your device.</p>
        <p className="text-red-300/80">
          Inference was stopped to keep your browser responsive. Try a smaller model — look for the{" "}
          <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-xs text-yellow-400 font-semibold">fast</span>{" "}
          badge.
        </p>
        <button
          onClick={() => { setPickerLocalOnly(false); setModelReady(false); }}
          className="flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
          Choose a lighter model
        </button>
      </div>
    </div>
  );
}

function SuggestLocalBubble() {
  const setModelReady      = useChatStore((s) => s.setModelReady);
  const setPickerLocalOnly = useChatStore((s) => s.setPickerLocalOnly);

  function handleSwitch() {
    setPickerLocalOnly(true);
    setModelReady(false);
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-slate-300">
        AI
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 space-y-3">
        <p>
          All cloud models are currently unavailable. You can switch to a free
          on-device model that runs entirely in your browser — no internet needed.
        </p>
        <button
          onClick={handleSwitch}
          className="flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
          Switch to on-device model
        </button>
      </div>
    </div>
  );
}

function SwitchedToCloudBubble() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-slate-300">
        AI
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200 space-y-2">
        <p className="font-semibold">Switched to cloud automatically</p>
        <p className="text-blue-300/80">
          No lighter on-device model is available for your device. Responses will now be handled by cloud inference.
        </p>
      </div>
    </div>
  );
}

export function StreamingBubble({ content }: StreamingBubbleProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-slate-300">
        AI
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-surface-secondary px-4 py-3 text-sm text-slate-100">
        <Markdown content={content} />
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-400 align-text-bottom" />
      </div>
    </div>
  );
}
