import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { locate } from "@/lib/location";
import type { ChatMessage } from "@/lib/types";
import { readJSON, writeJSON } from "@/lib/storage";

const STORE_KEY = "feelit_conversation";
const HISTORY_SENT = 12;
const NEAR_ME = /\b(near ?(me|by)|around (me|here)|close to me|where i am)\b/i;

interface Conversation {
  messages: ChatMessage[];
  /** Tool steps of the turn in progress (null when idle). */
  live: { text: string; steps: string[] } | null;
  send: (text: string) => Promise<void>;
  reset: () => void;
}

const ConversationContext = createContext<Conversation | null>(null);

/** The planning chat, kept for the whole browser session so it survives page changes. */
export function ConversationProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => readJSON<ChatMessage[]>(STORE_KEY, [], "session"));
  const [live, setLive] = useState<Conversation["live"]>(null);

  useEffect(() => writeJSON(STORE_KEY, messages, "session"), [messages]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || live) return;
      const steps: string[] = [];
      setLive({ text: message, steps });
      let coords = {};
      if (NEAR_ME.test(message)) {
        setLive({ text: message, steps: ["Finding where you are"] });
        coords = await locate().catch((error: Error) => (toast(error.message), {}));
      }
      const history = messages.slice(-HISTORY_SENT).map((m) => ({ role: m.role, content: m.role === "assistant" ? m.memory || m.text : m.text }));
      try {
        const reply = await api.agent({ message, history, ...coords }, (step) => {
          steps.push(step);
          setLive({ text: message, steps: [...steps] });
        });
        setMessages((current) => [...current, { role: "user", text: message }, { ...reply, steps }]);
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setLive(null);
      }
    },
    [messages, live],
  );

  const value = useMemo(() => ({ messages, live, send, reset: () => setMessages([]) }), [messages, live, send]);
  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversation() {
  const conversation = useContext(ConversationContext);
  if (!conversation) throw new Error("useConversation must be used inside ConversationProvider");
  return conversation;
}
