import clsx from "clsx";
import ReactMarkdown from "react-markdown";
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
      <div
        className={clsx(
          "max-w-[75%] rounded-2xl px-4 py-3 text-sm",
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
  );
}

interface StreamingBubbleProps {
  content: string;
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
