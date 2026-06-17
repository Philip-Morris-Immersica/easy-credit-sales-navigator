"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Send, X, Loader2, BarChart2, RefreshCw, User, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AnalysisFeedback } from "./AnalysisFeedback";
import { getBotAvatar } from "@/lib/bot-avatars";
import type { PersonaData } from "@/components/navigator/types";

export interface ChatWindowProps {
  botKey: string;
  botTitle: string;
  welcomeMessage?: string;
  kind: "simulation" | "consultant";
  persona?: PersonaData;
  onClose?: () => void;
  className?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AnalysisData {
  overallScore: number;
  criteria: Array<{ name: string; score: number; comment: string }>;
  strengths: string[];
  improvements: string[];
  summary: string;
}

export function ChatWindow({
  botKey,
  botTitle,
  welcomeMessage,
  kind,
  persona,
  onClose,
  className,
}: ChatWindowProps) {
  const avatarSrc = getBotAvatar(botKey);
  const { data: session } = useSession();
  const [showPersona, setShowPersona] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [ended, setEnded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Show welcome message
  useEffect(() => {
    if (welcomeMessage) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: welcomeMessage,
        },
      ]);
    }
  }, [welcomeMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, analysis]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || ended) return;
    if (!session?.user) {
      alert("Моля влезте в профила си, за да използвате чата.");
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botKey,
          message: userMsg.content,
          conversationId,
          newConversation: isNew,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const newConvId = res.headers.get("X-Conversation-Id");
      if (newConvId) {
        setConversationId(newConvId);
        setIsNew(false);
      }

      // Stream the response (plain text stream from toTextStreamResponse)
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: fullText } : m
            )
          );
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Грешка при свързване. Опитайте отново." }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, ended, session, botKey, conversationId, isNew]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEndSimulation = async () => {
    if (!conversationId) return;
    setEnded(true);
    setAnalysisLoading(true);

    try {
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
        setShowAnalysis(true);
      }
    } catch {
      alert("Грешка при генериране на анализ.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  if (showAnalysis && analysis) {
    return (
      <div className={cn("flex flex-col h-full bg-white rounded-2xl overflow-hidden", className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-white rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            {avatarSrc && (
              <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white/40">
                <AvatarImage src={avatarSrc} alt={botTitle} className="object-cover" />
                <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                  {botTitle.charAt(0)}
                </AvatarFallback>
              </Avatar>
            )}
            <span className="font-semibold t-body">Анализ — {botTitle}</span>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <AnalysisFeedback analysis={analysis} />
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAnalysis(false)}>
              Разговорът
            </Button>
            <Button size="sm" onClick={onClose}>
              Затвори
            </Button>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ── Persona panel view ──────────────────────────────────────────────────────
  if (showPersona && persona) {
    const metaRows: [string, string][] = [
      ["Тип контакт", persona.contactType],
      ["Персонаж", persona.name],
      ["Профил", persona.profile],
      ["Контекст", persona.context],
      ["Цел", persona.goal],
      ["Логика на разговора", persona.conversationLogic],
    ];
    return (
      <div className={cn("flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-xl", className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowPersona(false)}
              className="text-white hover:bg-white/20"
              aria-label="Назад"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <User className="h-4 w-4 shrink-0" />
            <span className="font-semibold t-body">Персонаж — {persona.name}</span>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-4">
            {metaRows.map(([label, value]) => (
              <div key={label}>
                <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-primary/80">{label}</p>
                <p className="text-sm text-foreground mt-0.5 leading-snug">{value}</p>
              </div>
            ))}
            <div>
              <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-primary/80">Примерни реплики</p>
              <ul className="mt-1 space-y-1">
                {persona.sampleReplies.map((r, i) => (
                  <li key={i} className="text-sm text-foreground/80 italic leading-snug before:content-['›'] before:mr-1.5 before:text-primary/60">{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-primary/80">Възможни възражения</p>
              <ul className="mt-1 space-y-1">
                {persona.objections.map((o, i) => (
                  <li key={i} className="text-sm text-foreground/80 leading-snug before:content-['!'] before:mr-1.5 before:text-destructive/70 before:font-bold">{o}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-primary/80">Подходящи техники</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {persona.techniques.map((t, i) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-primary/80">Следваща стъпка</p>
              <p className="text-sm text-foreground mt-0.5 leading-snug">{persona.nextStep}</p>
            </div>
            <div className="rounded-xl bg-destructive/5 border border-destructive/20 px-3 py-2.5">
              <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-destructive/80 mb-1">Какво да не правиш</p>
              <p className="text-sm text-foreground/80 leading-snug">{persona.doNotDo}</p>
            </div>
          </div>
        </ScrollArea>
        <div className="border-t px-4 py-3 shrink-0">
          <Button className="w-full gap-2" onClick={() => setShowPersona(false)}>
            <ChevronLeft className="h-4 w-4" />
            Обратно към разговора
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-xl", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-white rounded-t-2xl shrink-0">
        <div className="flex items-center gap-2.5">
          {avatarSrc && (
            <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white/40">
              <AvatarImage src={avatarSrc} alt={botTitle} className="object-cover" />
              <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                {botTitle.charAt(0)}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="font-semibold t-body">{botTitle}</span>
          {kind === "simulation" && (
            <Badge className="bg-white/20 text-white border-white/30 text-xs">Симулация</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Persona info button — always visible for simulations with persona */}
          {kind === "simulation" && persona && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowPersona(true)}
              className="text-white hover:bg-white/20"
              title="Информация за клиента"
            >
              <User className="h-4 w-4" />
            </Button>
          )}
          {/* Analyze button — always visible for simulations, disabled before first exchange */}
          {kind === "simulation" && !ended && (
            <Button
              size="sm"
              onClick={handleEndSimulation}
              disabled={analysisLoading || !conversationId}
              style={{
                backgroundColor: "#dae5ed",
                color: conversationId ? "#3d4a54" : "#9baab3",
                boxShadow: "2px 3px 10px rgba(0,0,0,0.35)",
              }}
              className="font-bold text-xs gap-1.5 px-3 border-0 hover:opacity-90"
              title={!conversationId ? "Изпрати поне едно съобщение, за да анализираш" : "Анализирай разговора"}
            >
              {analysisLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart2 className="h-3.5 w-3.5" />}
              Анализирай разговора
            </Button>
          )}
          {analysis && !ended && (
            <Button
              size="sm"
              onClick={() => setShowAnalysis(true)}
              style={{
                backgroundColor: "#dae5ed",
                color: "#3d4a54",
                boxShadow: "2px 3px 10px rgba(0,0,0,0.35)",
              }}
              className="font-bold text-xs gap-1.5 px-3 border-0 hover:opacity-90"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Виж анализа
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-end gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && avatarSrc && (
                <Avatar className="h-6 w-6 shrink-0 mb-0.5">
                  <AvatarImage src={avatarSrc} alt={botTitle} className="object-cover" />
                  <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                    {botTitle.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 t-body",
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                {msg.content || (loading && msg.role === "assistant" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null)}
              </div>
            </div>
          ))}
          {ended && !analysisLoading && !analysis && (
            <div className="text-center t-small text-muted-foreground py-2">
              Симулацията е приключена.
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 shrink-0">
        {ended ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => {
                setMessages([]);
                setConversationId(null);
                setIsNew(true);
                setEnded(false);
                setAnalysis(null);
                if (welcomeMessage) {
                  setMessages([{ id: "welcome", role: "assistant", content: welcomeMessage }]);
                }
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Нова симулация
            </Button>
            {analysis && (
              <Button size="sm" className="flex-1 gap-2" onClick={() => setShowAnalysis(true)}>
                <BarChart2 className="h-3.5 w-3.5" />
                Виж анализа
              </Button>
            )}
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={kind === "simulation" ? "Говори с клиента…" : "Попитай Роби…"}
              className="flex-1 resize-none min-h-[40px] max-h-[120px] rounded-xl border-border"
              rows={1}
              disabled={loading}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
