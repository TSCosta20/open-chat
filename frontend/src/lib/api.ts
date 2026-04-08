import type { Chat, Message } from "@/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Helpers ────────────────────────────────────────────────────────────────

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      v,
    ])
  );
}

function toChat(raw: Record<string, unknown>): Chat {
  return snakeToCamel(raw) as unknown as Chat;
}

function toMessage(raw: Record<string, unknown>): Message {
  return snakeToCamel(raw) as unknown as Message;
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Chats ──────────────────────────────────────────────────────────────────

export async function fetchChats(token?: string): Promise<Chat[]> {
  const res = await fetch(`${API_URL}/chats`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch chats");
  const data = await res.json();
  return data.map(toChat);
}

export async function createChat(title = "New Chat", token?: string): Promise<Chat> {
  const res = await fetch(`${API_URL}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return toChat(await res.json());
}

export async function renameChat(id: string, title: string, token?: string): Promise<Chat> {
  const res = await fetch(`${API_URL}/chats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to rename chat");
  return toChat(await res.json());
}

export async function updateChatModel(id: string, model: string, token?: string): Promise<void> {
  await fetch(`${API_URL}/chats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ model }),
  }).catch(() => {});
}

export async function deleteChat(id: string, token?: string): Promise<void> {
  const res = await fetch(`${API_URL}/chats/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete chat");
}

// ─── Messages ───────────────────────────────────────────────────────────────

export async function fetchMessages(chatId: string, token?: string): Promise<Message[]> {
  const res = await fetch(`${API_URL}/messages/${chatId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  const data = await res.json();
  return data.map(toMessage);
}
