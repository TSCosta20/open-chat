import { create } from "zustand";
import type { Chat, Message, ModelId } from "@/types";
import { DEFAULT_MODEL } from "@/types";

const LAST_MODEL_KEY = "oc_last_model";

function readLastModel(): ModelId {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  return localStorage.getItem(LAST_MODEL_KEY) ?? DEFAULT_MODEL;
}

/** Returns true only if the user has ever explicitly chosen a model. */
export function hasStoredModel(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LAST_MODEL_KEY) !== null;
}

function saveLastModel(model: ModelId) {
  if (typeof window !== "undefined") localStorage.setItem(LAST_MODEL_KEY, model);
}

interface ChatStore {
  // State
  chats: Chat[];
  activeChatId: string | null;
  messages: Record<string, Message[]>;
  streamingContent: Record<string, string>;
  isStreaming: Record<string, boolean>;
  selectedModel: Record<string, ModelId>;

  // Model load state (global — one engine at a time)
  modelReady: boolean;
  modelLoadProgress: number;    // 0–100
  modelLoadStatus: string;      // human-readable status text

  // Chat list actions
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  removeChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  setActiveChatId: (id: string | null) => void;

  // Message actions
  setMessages: (chatId: string, messages: Message[]) => void;
  appendMessage: (chatId: string, message: Message) => void;

  // Streaming actions
  appendStreamingContent: (chatId: string, token: string) => void;
  clearStreamingContent: (chatId: string) => void;
  setIsStreaming: (chatId: string, val: boolean) => void;

  // Cloud status (e.g. "Trying Llama 3.3 70B…")
  cloudStatus: Record<string, string>;
  setCloudStatus: (chatId: string, status: string) => void;

  // When true, model picker opens on local tab with cloud hidden
  pickerLocalOnly: boolean;
  setPickerLocalOnly: (val: boolean) => void;

  // Model selection
  setModelForChat: (chatId: string, model: ModelId) => void;
  getModelForChat: (chatId: string) => ModelId;

  // WebLLM load state
  setModelReady: (ready: boolean) => void;
  setModelLoadProgress: (progress: number, status: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  streamingContent: {},
  isStreaming: {},
  cloudStatus: {},
  selectedModel: {},
  modelReady: false,
  modelLoadProgress: 0,
  modelLoadStatus: "",

  setChats: (chats) => set({ chats }),

  addChat: (chat) =>
    set((s) => ({ chats: [chat, ...s.chats] })),

  removeChat: (id) =>
    set((s) => ({
      chats: s.chats.filter((c) => c.id !== id),
      activeChatId: s.activeChatId === id ? null : s.activeChatId,
    })),

  renameChat: (id, title) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === id ? { ...c, title } : c)),
    })),

  setActiveChatId: (id) => set({ activeChatId: id }),

  setMessages: (chatId, messages) =>
    set((s) => ({ messages: { ...s.messages, [chatId]: messages } })),

  appendMessage: (chatId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: [...(s.messages[chatId] ?? []), message],
      },
    })),

  appendStreamingContent: (chatId, token) =>
    set((s) => ({
      streamingContent: {
        ...s.streamingContent,
        [chatId]: (s.streamingContent[chatId] ?? "") + token,
      },
    })),

  clearStreamingContent: (chatId) =>
    set((s) => {
      const next = { ...s.streamingContent };
      delete next[chatId];
      return { streamingContent: next };
    }),

  setIsStreaming: (chatId, val) =>
    set((s) => ({ isStreaming: { ...s.isStreaming, [chatId]: val } })),

  setCloudStatus: (chatId, status) =>
    set((s) => ({ cloudStatus: { ...s.cloudStatus, [chatId]: status } })),

  pickerLocalOnly: false,
  setPickerLocalOnly: (val) => set({ pickerLocalOnly: val }),

  setModelForChat: (chatId, model) => {
    saveLastModel(model);
    set((s) => ({ selectedModel: { ...s.selectedModel, [chatId]: model } }));
  },

  getModelForChat: (chatId) => get().selectedModel[chatId] ?? readLastModel(),

  setModelReady: (ready) => set({ modelReady: ready }),

  setModelLoadProgress: (progress, status) =>
    set({ modelLoadProgress: progress, modelLoadStatus: status }),
}));
