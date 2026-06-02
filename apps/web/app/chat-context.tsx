"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";

type ToolCallInfo = { name: string; result?: string; loading?: boolean };

type FileInfo = { name: string; path: string };

export interface DecisionCardOption {
  id: string;
  title: string;
  description: string;
  tradeoff: string;
  estimatedUserTime: string;
  riskLevel: string;
  qualityCeiling: number;
  isRecommended: boolean;
}

export interface DecisionCardSet {
  type: "decision_cards";
  title: string;
  recommendedOptionId: string;
  options: DecisionCardOption[];
}

export interface PresentationBrief {
  id: string;
  projectId: string;
  deliverableType: "course_ppt" | "lab_meeting" | "exam_review";
  presentationDuration: number;
  deadline: string | null;
  targetAudience: string;
  sourceIds: string[];
  missingInfo: string[];
  detectedCourseName: string | null;
  requiresSpeakerNotes: boolean;
  requiresEnglish: boolean;
  pageRequirement: number | null;
}

export interface ProgressDetail {
  label: string;
  status: "completed" | "in_progress" | "queued" | "failed" | "skipped";
  detail: string;
  percentage: number;
}

export interface ThinkingEntry {
  timestamp: string;
  type: "decision" | "observation" | "plan" | "error";
  content: string;
  relatedEvidence?: string[];
}

export interface AgentProcessUpdate {
  agentId: string;
  agentName: string;
  status: "idle" | "working" | "waiting" | "completed" | "failed";
  currentTask: string;
  progress: ProgressDetail[];
  outputPreview?: Record<string, unknown>;
}

export interface AgentProcessCard {
  agentId: string;
  agentName: string;
  agentIcon: string;
  agentRole: string;
  status: "idle" | "working" | "waiting" | "completed" | "failed";
  currentTask: string;
  progress: ProgressDetail[];
  inputFrom: string[];
  outputTo: string[];
  thinkingLog: ThinkingEntry[];
  startedAt: string;
  estimatedCompletion: string | null;
}

export interface CollaborationSnapshot {
  agents: Array<{
    agentId: string;
    agentName: string;
    status: "idle" | "working" | "waiting" | "completed" | "failed";
  }>;
  edges: Array<{
    from: string;
    to: string;
    dataType: string;
  }>;
  bottleneck: string | null;
  elapsedTime: number;
  estimatedRemaining: number | null;
}

export type AssistantMsg = {
  role: "assistant";
  content: string;
  toolCalls?: ToolCallInfo[];
  thinking?: string;
  files?: FileInfo[];
  decisionCards?: DecisionCardSet;
  taskBrief?: PresentationBrief;
  agentProcess?: AgentProcessUpdate;
  agentThinking?: ThinkingEntry;
  agentCollaboration?: CollaborationSnapshot;
};

export type Msg =
  | { role: "user"; content: string }
  | AssistantMsg
  | { role: "gate"; gateId: string; gateType: string; reason: string; riskLevel: string; resolved: boolean }
  | { role: "system"; content: string };

interface ChatSession {
  projectId: string | null;
  agentSessionId: string | null;
  messages: Msg[];
  agentCards: AgentProcessCard[];
  collaboration: CollaborationSnapshot | null;
}

interface ChatContextValue {
  session: ChatSession;
  setSession: (session: ChatSession | ((prev: ChatSession) => ChatSession)) => void;
  addMessage: (msg: Msg) => void;
  updateLastAssistant: (update: Partial<AssistantMsg>) => void;
  updateAgentCard: (agentId: string, update: Partial<AgentProcessCard>) => void;
  setCollaboration: (snapshot: CollaborationSnapshot) => void;
  clearSession: () => void;
  setStreaming: (v: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const STORAGE_KEY = "zhixu-chat-session";

const defaultSession: ChatSession = { projectId: null, agentSessionId: null, messages: [], agentCards: [], collaboration: null };

function loadFromStorage(): ChatSession {
  if (typeof window === "undefined") return defaultSession;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.messages)) {
        return { ...defaultSession, ...parsed };
      }
    }
  } catch {}
  return defaultSession;
}

function saveToStorage(session: ChatSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<ChatSession>(defaultSession);
  const [hydrated, setHydrated] = useState(false);
  const streamingRef = useRef(false);

  useEffect(() => {
    const stored = loadFromStorage();
    setSessionState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !streamingRef.current) {
      saveToStorage(session);
    }
  }, [session, hydrated]);

  const setSession = useCallback((s: ChatSession | ((prev: ChatSession) => ChatSession)) => {
    setSessionState((prev) => {
      const next = typeof s === "function" ? s(prev) : s;
      return next;
    });
  }, []);

  const addMessage = useCallback((msg: Msg) => {
    setSessionState((prev) => {
      const next = { ...prev, messages: [...prev.messages, msg] };
      if (!streamingRef.current) saveToStorage(next);
      return next;
    });
  }, []);

  const updateLastAssistant = useCallback((update: Partial<AssistantMsg>) => {
    setSessionState((prev) => {
      const msgs = [...prev.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, ...update } as AssistantMsg;
      }
      const next = { ...prev, messages: msgs };
      if (!streamingRef.current) saveToStorage(next);
      return next;
    });
  }, []);

  const updateAgentCard = useCallback((agentId: string, update: Partial<AgentProcessCard>) => {
    setSessionState((prev) => {
      const existing = prev.agentCards.find((c) => c.agentId === agentId);
      let agentCards: AgentProcessCard[];
      if (existing) {
        agentCards = prev.agentCards.map((c) =>
          c.agentId === agentId ? { ...c, ...update } : c
        );
      } else {
        agentCards = [
          ...prev.agentCards,
          {
            agentId,
            agentName: update.agentName ?? agentId,
            agentIcon: update.agentIcon ?? "🤖",
            agentRole: update.agentRole ?? "",
            status: update.status ?? "idle",
            currentTask: update.currentTask ?? "",
            progress: update.progress ?? [],
            inputFrom: update.inputFrom ?? [],
            outputTo: update.outputTo ?? [],
            thinkingLog: update.thinkingLog ?? [],
            startedAt: update.startedAt ?? new Date().toISOString(),
            estimatedCompletion: update.estimatedCompletion ?? null,
          },
        ];
      }
      const next = { ...prev, agentCards };
      if (!streamingRef.current) saveToStorage(next);
      return next;
    });
  }, []);

  const setCollaboration = useCallback((snapshot: CollaborationSnapshot) => {
    setSessionState((prev) => {
      const next = { ...prev, collaboration: snapshot };
      if (!streamingRef.current) saveToStorage(next);
      return next;
    });
  }, []);

  const clearSession = useCallback(() => {
    const next: ChatSession = { projectId: null, agentSessionId: null, messages: [], agentCards: [], collaboration: null };
    setSessionState(next);
    saveToStorage(next);
  }, []);

  const setStreaming = useCallback((v: boolean) => {
    streamingRef.current = v;
    if (!v) {
      setSessionState((prev) => {
        saveToStorage(prev);
        return prev;
      });
    }
  }, []);

  return (
    <ChatContext.Provider value={{ session, setSession, addMessage, updateLastAssistant, updateAgentCard, setCollaboration, clearSession, setStreaming }}>
      {children}
    </ChatContext.Provider>
  );
}

const defaultContext: ChatContextValue = {
  session: defaultSession,
  setSession: () => {},
  addMessage: () => {},
  updateLastAssistant: () => {},
  updateAgentCard: () => {},
  setCollaboration: () => {},
  clearSession: () => {},
  setStreaming: () => {},
};

export function useChat() {
  const ctx = useContext(ChatContext);
  return ctx ?? defaultContext;
}
