"use client";

import { useRef } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface Props {
  chatId: string;
}

export function ChatWindow({ chatId }: Props) {
  const messages = useChatStore((s) => s.messages[chatId] ?? []);
  const streamingContent = useChatStore((s) => s.streamingContent[chatId]);
  const isStreaming = useChatStore((s) => s.isStreaming[chatId] ?? false);
  const cloudStatus = useChatStore((s) => s.cloudStatus[chatId] ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);

  useAutoScroll(bottomRef, [messages, streamingContent]);

  const showTypingDots = isStreaming && !streamingContent && !cloudStatus;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto scrollbar-thin">
      {messages.length === 0 && !isStreaming ? (
        <div className="flex flex-1 items-center justify-center text-slate-500">
          <p className="text-sm">Send a message to start the conversation</p>
        </div>
      ) : (
        <div className="flex flex-col py-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {showTypingDots && <TypingIndicator />}
          {cloudStatus && !streamingContent && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 italic">
              <span className="inline-flex gap-0.5">
                <span className="animate-bounce [animation-delay:0ms]">·</span>
                <span className="animate-bounce [animation-delay:150ms]">·</span>
                <span className="animate-bounce [animation-delay:300ms]">·</span>
              </span>
              {cloudStatus}
            </div>
          )}
          {streamingContent && <StreamingBubble content={streamingContent} />}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
