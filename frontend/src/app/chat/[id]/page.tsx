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

  useEffect(() => {
    setActiveChatId(id);
    return () => setActiveChatId(null);
  }, [id, setActiveChatId]);

  useEffect(() => {
    if (!messages[id] && session?.backendToken) {
      fetchMessages(id, session.backendToken)
        .then((msgs) => setMessages(id, msgs))
        .catch(() => setMessages(id, []));
    }
  }, [id, messages, setMessages, session?.backendToken]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {!modelReady ? (
        <ModelPickerScreen chatId={id} />
      ) : (
        <ChatWindow chatId={id} />
      )}
      <InputBar chatId={id} />
    </div>
  );
}
