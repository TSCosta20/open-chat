"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import clsx from "clsx";
import { useChatStore } from "@/store/useChatStore";
import { ChatListItem } from "./ChatListItem";
import { NewChatButton } from "./NewChatButton";

function ModelStatus() {
  const modelReady = useChatStore((s) => s.modelReady);
  const progress = useChatStore((s) => s.modelLoadProgress);
  const status = useChatStore((s) => s.modelLoadStatus);

  if (modelReady) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        Model ready
      </div>
    );
  }

  if (progress > 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Loading model…</span>
          <span className="text-slate-500">{progress}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-surface-primary overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {status && <p className="truncate text-xs text-slate-600">{status}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      No model loaded
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const chats = useChatStore((s) => s.chats);
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const activeChatId = pathname.startsWith("/chat/")
    ? pathname.split("/chat/")[1]
    : null;

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="absolute left-4 top-4 z-50 rounded-lg p-2 text-slate-400 hover:text-white md:hidden"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Toggle sidebar"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Sidebar panel */}
      <aside
        className={clsx(
          "flex h-full w-64 shrink-0 flex-col border-r border-surface-border bg-surface-secondary transition-transform duration-200",
          "fixed inset-y-0 left-0 z-40 md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-4">
          <span className="text-base font-semibold text-white">open_chat</span>
        </div>

        {/* New chat button */}
        <div className="px-2 py-2">
          <NewChatButton />
        </div>

        {/* Chat list */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
          {chats.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-500">No chats yet</p>
          ) : (
            chats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === activeChatId}
              />
            ))
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-surface-border px-4 py-3 space-y-3">
          <ModelStatus />
          <Link
            href="/setup"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            Setup guide
          </Link>
          {session?.user && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-slate-400">
                {session.user.name ?? session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/sign-in" })}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-surface-hover hover:text-white transition-colors"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
