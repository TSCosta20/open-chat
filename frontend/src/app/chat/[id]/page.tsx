"use client";

import { use, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/useChatStore";
import { fetchMessages } from "@/lib/api";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InputBar } from "@/components/chat/InputBar";
import { ModelPickerScreen } from "@/components/chat/ModelPickerScreen";

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
    return () => setActiveChatId(null);
  }, [id, setActiveChatId]);

  useEffect(() => {
    if (!messages[id] && session?.backendToken) {
      fetchMessages(id, session.backendToken)
        .then((msgs) => {
          setMessages(id, msgs);
          // Restore model saved for this chat on another device
          const chat = useChatStore.getState().chats.find((c) => c.id === id);
          if (chat?.model && chat.model !== "unknown") {
            useChatStore.getState().setModelForChat(id, chat.model);
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
        /* ChatGPT-style: centered greeting + input */
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-8">
          <h1 className="text-3xl font-semibold text-white">
            What&apos;s on your mind today?
          </h1>
          <div className="w-full max-w-2xl">
            <InputBar chatId={id} centered />
          </div>
        </div>
      ) : (
        /* Active conversation: messages + bottom input */
        <>
          <ChatWindow chatId={id} />
          <InputBar chatId={id} />
        </>
      )}
    </div>
  );
}
