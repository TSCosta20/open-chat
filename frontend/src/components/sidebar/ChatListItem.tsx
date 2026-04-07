"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import type { Chat } from "@/types";
import { useChatStore } from "@/store/useChatStore";
import { renameChat, deleteChat } from "@/lib/api";

interface Props {
  chat: Chat;
  isActive: boolean;
}

export function ChatListItem({ chat, isActive }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const { renameChat: storeRename, removeChat } = useChatStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  async function handleRename() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === chat.title) {
      setEditValue(chat.title);
      setIsEditing(false);
      return;
    }
    try {
      await renameChat(chat.id, trimmed, session?.backendToken);
      storeRename(chat.id, trimmed);
    } catch {
      setEditValue(chat.title);
    }
    setIsEditing(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteChat(chat.id, session?.backendToken);
      removeChat(chat.id);
      if (isActive) router.push("/chat");
    } catch {
      // ignore
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleRename();
    if (e.key === "Escape") {
      setEditValue(chat.title);
      setIsEditing(false);
    }
  }

  return (
    <div
      className={clsx(
        "group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-surface-hover text-white"
          : "text-slate-400 hover:bg-surface-hover hover:text-white"
      )}
      onClick={() => !isEditing && router.push(`/chat/${chat.id}`)}
    >
      <svg
        className="h-4 w-4 shrink-0 text-slate-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
        />
      </svg>

      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 truncate bg-transparent text-white outline-none"
        />
      ) : (
        <span className="flex-1 truncate">{chat.title}</span>
      )}

      {!isEditing && (
        <div className="absolute right-2 hidden gap-1 group-hover:flex">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEditValue(chat.title);
              setIsEditing(true);
            }}
            className="rounded p-1 text-slate-400 hover:text-white"
            title="Rename"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="rounded p-1 text-slate-400 hover:text-red-400"
            title="Delete"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
