"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, Plus, Sparkles } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}

const createMessage = (role: ChatMessage["role"], content = ""): ChatMessage => ({
  id: uuidv4(),
  role,
  content,
  createdAt: Date.now(),
});

const extractTextFromPayload = (payload: unknown): string | null => {
  const results = new Set<string>();

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        results.add(trimmed);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;

      const candidates = ["answer", "content", "message", "text", "value"] as const;
      for (const key of candidates) {
        if (typeof obj[key] === "string") {
          visit(obj[key]);
        }
      }

      if (Array.isArray(obj.Choices)) {
        obj.Choices.forEach((choice) => {
          if (choice && typeof choice === "object") {
            const c = choice as Record<string, unknown>;
            if (typeof c.Content === "string" && c.Content.trim()) {
              visit(c.Content);
            }
            if (c.Delta && typeof c.Delta === "object") {
              const delta = c.Delta as Record<string, unknown>;
              if (typeof delta.content === "string") {
                visit(delta.content);
              }
            }
          }
        });
      }

      if (obj.data !== undefined) {
        visit(obj.data);
      }
    }
  };

  visit(payload);

  if (results.size === 0) {
    return null;
  }

  return Array.from(results).join("\n");
};

export default function AIChatPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createMessage(
      "system",
      "欢迎使用 iKnowHUST AI 问答助手。我可以帮助你快速查找校园信息，欢迎随时提问。",
    ),
  ]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, updater: (content: string) => string) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, content: updater(msg.content) } : msg)));
  }, []);

  const currentConversationMessages = useMemo(() => messages.filter((msg) => msg.role !== "system"), [messages]);
  const userConversations = useMemo(
    () =>
      currentConversationMessages
        .filter((msg) => msg.role === "user")
        .map((msg, index) => ({
          id: msg.id,
          title: msg.content.trim() || `提问 ${index + 1}`,
          createdAt: msg.createdAt,
        }))
        .reverse(),
    [currentConversationMessages],
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [currentConversationMessages.length]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = question.trim();
      if (!trimmed) {
        toast({
          title: "请输入问题",
          description: "内容不能为空。",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);
      setQuestion("");

      const userMessage = createMessage("user", trimmed);
      appendMessage(userMessage);

      const assistantMessage = createMessage("assistant");
      appendMessage(assistantMessage);

      try {
        const response = await fetch("/api/ai-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: trimmed,
            responseMode: "streaming",
          }),
        });

        if (!response.ok) {
          let errorMessage = `接口返回错误状态：${response.status}`;
          try {
            const problem = (await response.clone().json()) as {
              message?: string;
              upstreamCode?: number;
              upstreamMessage?: string | null;
              upstreamStatus?: number;
              upstreamStatusText?: string;
              upstreamBody?: string | null;
              attempts?: number;
            };

            if (problem) {
              console.error("AI chat upstream diagnostic", problem);
            }

            if (problem?.message) {
              const upstreamParts: string[] = [];

              if (typeof problem.upstreamCode === "number") {
                const codeDetail = `code=${problem.upstreamCode}`;
                const messageDetail = problem.upstreamMessage ? `msg=${problem.upstreamMessage}` : undefined;
                upstreamParts.push(messageDetail ? `${codeDetail}，${messageDetail}` : codeDetail);
              }

              if (typeof problem.upstreamStatus === "number") {
                upstreamParts.push(
                  `status=${problem.upstreamStatus}${problem.upstreamStatusText ? ` ${problem.upstreamStatusText}` : ""}`,
                );
              }

              if (typeof problem.attempts === "number" && problem.attempts > 1) {
                upstreamParts.push(`重试次数=${problem.attempts}`);
              }

              if (!upstreamParts.length && problem.upstreamBody) {
                upstreamParts.push(`body=${problem.upstreamBody}`);
              }

              const upstreamHint = upstreamParts.length ? `（上游 ${upstreamParts.join("；")}）` : "";
              errorMessage = `${problem.message}${upstreamHint}`;
            }
          } catch {
            try {
              const text = await response.clone().text();
              if (text.trim()) {
                errorMessage = `${errorMessage} - ${text.trim()}`;
              }
            } catch {
              // ignore
            }
          }

          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error("接口未返回有效的响应流");
        }

        const contentType = response.headers.get("content-type") ?? "";

        if (!contentType.includes("text/event-stream")) {
          const rawText = await response.text();
          let aiText = rawText.trim();

          if (rawText.trim()) {
            try {
              const parsed = JSON.parse(rawText) as unknown;
              const extracted = extractTextFromPayload(parsed);
              if (extracted) {
                aiText = extracted;
              }
            } catch {
              // ignore JSON parse errors, fallback to raw text
            }
          }

          updateMessage(assistantMessage.id, () => (aiText ? aiText : "暂未获取到有效回复。"));
          setIsLoading(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const flushBuffer = (chunk: string) => {
          const segments = chunk.split("\n\n");
          buffer = segments.pop() ?? "";
          segments.forEach((segment) => {
            segment.split("\n").forEach((line) => {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith("data:")) {
                return;
              }

              let payload = trimmedLine;
              while (payload.startsWith("data:")) {
                payload = payload.slice(5).trimStart();
              }
              payload = payload.trim();

              if (!payload || payload === "[DONE]") {
                return;
              }

              let delta = "";
              try {
                const parsed = JSON.parse(payload) as Record<string, unknown>;
                const eventType = typeof parsed.event === "string" ? parsed.event : undefined;
                if (!eventType || ["message", "message_end", "message_delta", "completion"].includes(eventType)) {
                  const extracted = extractTextFromPayload(parsed);
                  if (extracted) {
                    delta = extracted;
                  }
                }
              } catch {
                // ignore malformed JSON; keep delta empty so raw片段不会展示
              }

              if (delta) {
                updateMessage(assistantMessage.id, (prev) => {
                  if (!prev) {
                    return delta;
                  }
                  if (prev.endsWith(delta)) {
                    return prev;
                  }
                  return `${prev}${delta}`;
                });
              }
            });
          });
        };

        while (true) {
          // eslint-disable-next-line no-await-in-loop
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          const chunkText = decoder.decode(value, { stream: true });
          flushBuffer(buffer + chunkText);
        }

        // Flush the remaining buffer
        if (buffer.trim()) {
          flushBuffer(`${buffer}\n\n`);
        }

        updateMessage(assistantMessage.id, (prev) => (prev.trim() ? prev : "暂未获取到有效回复。"));
      } catch (error) {
        console.error("AI chat request failed", error);
        updateMessage(assistantMessage.id, () => "抱歉，暂时无法获取 AI 回复，请稍后重试。");
        toast({
          title: "请求失败",
          description: error instanceof Error ? error.message : "服务暂时不可用",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [appendMessage, question, toast, updateMessage],
  );

  return (
    <div className="flex h-full min-h-screen flex-col bg-muted/40">
      <Header title="AI 问答助手" />
      <main className="flex flex-1 justify-center px-4 py-6 md:px-6 lg:px-10">
        <div className="flex w-full max-w-6xl flex-1 flex-col gap-6 lg:flex-row">
          <aside className="hidden w-full max-w-xs flex-shrink-0 flex-col rounded-2xl border bg-background shadow-sm lg:flex">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">智慧华中大</p>
                <h2 className="text-lg font-semibold text-foreground">智能问答</h2>
              </div>
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col gap-3 px-5 py-4">
              <Button variant="secondary" className="justify-start gap-2" onClick={() => setMessages((prev) => prev.slice(0, 1))}>
                <Plus className="h-4 w-4" />
                新对话
              </Button>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">历史对话</p>
                <p>快速回顾近期提问记录</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {userConversations.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  尚无提问，快来体验校园 AI 小助手吧～
                </div>
              ) : (
                <ul className="space-y-2">
                  {userConversations.map((item) => {
                    const date = new Date(item.createdAt);
                    const timeText = new Intl.DateTimeFormat("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(date);
                    return (
                      <li key={item.id} className="rounded-xl border bg-card/70 p-3 shadow-sm transition hover:border-primary">
                        <p className="truncate text-sm font-medium text-foreground" title={item.title}>
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{timeText}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <section className="flex flex-1 flex-col rounded-2xl border bg-background shadow-sm">
            <header className="flex flex-col gap-2 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-foreground">华小智 · AI 校园助手</h1>
                <p className="text-sm text-muted-foreground">为你解答教务、课程、生活服务等校园问题</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs text-primary">
                <MessageCircle className="h-4 w-4" />
                实时对话中
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6">
              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
            </div>

            <footer className="border-t px-4 py-4 sm:px-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <Textarea
                  placeholder="想了解的校园信息、课程安排、生活服务等都可以问我。"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={4}
                  disabled={isLoading}
                  className="resize-none rounded-xl border-muted bg-muted/30 p-4"
                />
                <div className="flex items-center justify-end gap-3">
                  <Button type="submit" disabled={isLoading} className="min-w-[120px] rounded-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在生成
                      </>
                    ) : (
                      "发送"
                    )}
                  </Button>
                </div>
              </form>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(message.createdAt);

  if (isSystem) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-primary/10 px-5 py-3 text-center text-sm text-primary">
        {message.content}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end text-right" : "justify-start text-left")}>
      <div className={cn("max-w-[80%] space-y-2 text-sm", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed shadow-sm",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          {message.content || "..."}
        </div>
        <p className="text-xs text-muted-foreground">{isUser ? "我" : "AI"} · {time}</p>
      </div>
    </div>
  );
}
