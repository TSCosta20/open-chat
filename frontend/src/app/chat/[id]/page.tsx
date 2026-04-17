"use client";

import { use, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useChatStore, hasStoredModel } from "@/store/useChatStore";
import { fetchMessages } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InputBar } from "@/components/chat/InputBar";
import { ModelPickerScreen } from "@/components/chat/ModelPickerScreen";

const EXAMPLE_PROMPTS = [
  "Explain this to me like I'm 10 years old:",
  "Write a short email about:",
  "What are the pros and cons of:",
  "Summarize the key points of:",
  "Help me brainstorm ideas for:",
  "What's the best way to:",
];

interface Props {
  params: Promise<{ id: string }>;
}

export default function ChatPage({ params }: Props) {
  const { id } = use(params);
  const { data: session } = useSession();
  const { setMessages, setActiveChatId, messages } = useChatStore();
  const modelReady = useChatStore((s) => s.modelReady);

  const hasMessages = (messages[id]?.length ?? 0) > 0;
  const isStreaming = useChatStore((s) => s.isStreaming[id] ?? false);
  const isEmpty = !hasMessages && !isStreaming;

  useEffect(() => {
    setActiveChatId(id);
    if (hasStoredModel()) {
      useChatStore.getState().setModelReady(true);
    }
    return () => setActiveChatId(null);
  }, [id, setActiveChatId]);

  useEffect(() => {
    if (!messages[id] && session?.backendToken) {
      fetchMessages(id, session.backendToken)
        .then((msgs) => {
          setMessages(id, msgs);
          const chat = useChatStore.getState().chats.find((c) => c.id === id);
          if (chat?.model && chat.model !== "unknown") {
            useChatStore.getState().setModelForChat(id, chat.model);
            useChatStore.getState().setModelReady(true);
          }
        })
        .catch(() => setMessages(id, []));
    }
  }, [id, messages, setMessages, session?.backendToken]);

  if (!modelReady) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <ModelPickerScreen chatId={id} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-8">
          <h1 className="text-2xl font-semibold text-white">
            What&apos;s on your mind?
          </h1>

          {/* Example prompts */}
          <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <ExamplePrompt key={prompt} chatId={id} text={prompt} />
            ))}
          </div>

          <div className="w-full max-w-2xl">
            <InputBar chatId={id} centered />
          </div>
        </div>
      ) : (
        <>
          <ChatWindow chatId={id} />
          <InputBar chatId={id} />
        </>
      )}
    </div>
  );
}

function ExamplePrompt({ chatId, text }: { chatId: string; text: string }) {
  const modelReady = useChatStore((s) => s.modelReady);
  const { sendMessage } = useChat(chatId);

  return (
    <button
      onClick={() => sendMessage(text)}
      disabled={!modelReady}
      className="rounded-xl border border-surface-border bg-surface-secondary px-3 py-2.5 text-left text-xs text-slate-400 transition-colors hover:border-slate-500 hover:bg-white/5 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {text}
    </button>
  );
}
