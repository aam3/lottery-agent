"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import BlockRenderer from "@/components/blocks/BlockRenderer";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import type { DashboardData, DashboardMode } from "@/components/dashboard/DashboardPanel";
import type { Block } from "@/components/blocks/types";
import { T } from "@/lib/tokens";

const STATES = ["NJ", "CA", "FL", "NY", "OH"] as const;

const VISUAL_TO_TOOL: Record<string, string> = {
  stats_table: "query_games",
  odds_chart: "get_marginal_odds",
  outcome_bars: "get_outcome_probabilities",
  scatter: "get_risk_reward",
};

const VISUAL_QUESTIONS: Record<string, string> = {
  stats_table: "How do these games compare?",
  odds_chart: "What should I know about the odds?",
  outcome_bars: "What are my chances of winning?",
  scatter: "How do these games compare on risk vs reward?",
};

interface ToolStep {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_result: unknown;
}

interface UsageSummary {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  iterations: number;
}

interface Turn {
  question: string;
  steps: ToolStep[];
  answer?: string;
  blocks?: Block[];
  usage: UsageSummary;
}

interface DashboardGameState {
  gameId: number;
  gameName: string;
  gameNumber: string;
}

export default function Home() {
  const [selectedState, setSelectedState] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef(
    `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );

  // Dashboard state
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("empty");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardGames, setDashboardGames] = useState<DashboardGameState[]>([]);
  // Pending tool hint for "Ask about this" (attached to next message)
  const [pendingToolHint, setPendingToolHint] = useState<{
    visual: string;
    toolName: string;
    gameIds: number[];
  } | null>(null);

  // Set of game IDs currently on the dashboard — drives "+ Explore" / "✓" toggle
  const dashboardGameIdSet = useMemo(
    () => new Set(dashboardGames.map((g) => g.gameId)),
    [dashboardGames],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  // ─── Dashboard fetching ──────────────────────────────────────────────────

  const fetchDashboard = useCallback(async (gameIds: number[]) => {
    if (gameIds.length === 0) {
      setDashboardMode("empty");
      setDashboardData(null);
      return;
    }

    setDashboardMode("loading");
    try {
      const res = await fetch(
        `/api/dashboard?gameIds=${gameIds.join(",")}&state=${selectedState}`,
      );
      if (!res.ok) {
        console.error("[dashboard] fetch failed:", res.status);
        setDashboardMode("empty");
        return;
      }
      const data: DashboardData = await res.json();
      setDashboardData(data);
      setDashboardMode("active");
      // Update dashboardGames with resolved names/numbers from API
      setDashboardGames(data.games.map((g) => ({
        gameId: g.gameId,
        gameName: g.gameName,
        gameNumber: g.gameNumber,
      })));
    } catch (err) {
      console.error("[dashboard] fetch error:", err);
      setDashboardMode("empty");
    }
  }, [selectedState]);

  // ─── Chat messaging ──────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!selectedState) {
      setError("Select a state first.");
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;

    setError("");
    setInput("");
    setLoading(true);

    const userMessage = `[State: ${selectedState}] ${trimmed}`;
    const newMessages = [
      ...messages,
      { role: "user" as const, content: userMessage },
    ];

    // Build request body with dashboard context
    const requestBody: Record<string, unknown> = {
      messages: newMessages,
      conversationId: conversationIdRef.current,
    };

    if (dashboardGames.length > 0) {
      requestBody.dashboardGames = dashboardGames.map((g) => ({
        name: g.gameName,
        number: g.gameNumber,
        id: g.gameId,
      }));
    }

    if (pendingToolHint) {
      requestBody.toolHint = pendingToolHint;
      setPendingToolHint(null);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Error: ${res.status}`);
        setLoading(false);
        return;
      }

      const assistantContent = data.answer ?? "[structured response]";
      setMessages([
        ...newMessages,
        { role: "assistant" as const, content: assistantContent },
      ]);
      setTurns([
        ...turns,
        {
          question: trimmed,
          steps: data.steps,
          answer: data.answer,
          blocks: data.blocks,
          usage: data.usage,
        },
      ]);
    } catch {
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleSend() {
    sendMessage(input);
  }

  function handleChoiceSelect(choice: string, prompt: string) {
    if (choice.toLowerCase() === "something else") {
      inputRef.current?.focus();
      return;
    }
    sendMessage(`${prompt} ${choice}`);
  }

  function handleExploreSelect(option: string) {
    if (option.toLowerCase() === "i'm all set") return;
    sendMessage(option);
  }

  async function handleExploreGame(gameName: string, gameNumber: string, gameId?: number) {
    if (!selectedState) return;

    if (!gameId) {
      // Fallback: resolve game_id via dashboard API using gameNumber
      setDashboardMode("loading");
      try {
        const res = await fetch(
          `/api/dashboard?gameNumbers=${gameNumber}&state=${selectedState}`,
        );
        if (!res.ok) {
          console.error("[explore] fallback fetch failed:", res.status);
          setDashboardMode(dashboardGames.length > 0 ? "active" : "empty");
          return;
        }
        const data: DashboardData = await res.json();
        // Extract the resolved game_id from the response
        const resolvedGame = data.games[0];
        if (resolvedGame) {
          const newGame = {
            gameId: resolvedGame.gameId,
            gameName: resolvedGame.gameName,
            gameNumber: resolvedGame.gameNumber,
          };
          const alreadyInTray = dashboardGames.some((g) => g.gameId === newGame.gameId);
          const newGames = alreadyInTray ? dashboardGames : [...dashboardGames, newGame];
          setDashboardGames(newGames.slice(0, 4));
          // Re-fetch with all tray game IDs for combined view
          if (newGames.length > 1 && !alreadyInTray) {
            fetchDashboard(newGames.slice(0, 4).map((g) => g.gameId));
          } else {
            setDashboardData(data);
            setDashboardMode("active");
          }
        }
      } catch (err) {
        console.error("[explore] fallback error:", err);
        setDashboardMode(dashboardGames.length > 0 ? "active" : "empty");
      }
      return;
    }

    // Add game to tray if not already there
    const alreadyInTray = dashboardGames.some((g) => g.gameId === gameId);
    const newGames = alreadyInTray
      ? dashboardGames
      : [...dashboardGames, { gameId, gameName, gameNumber }];

    if (newGames.length > 4) {
      const singleGame = [{ gameId, gameName, gameNumber }];
      setDashboardGames(singleGame);
      fetchDashboard(singleGame.map((g) => g.gameId));
    } else {
      setDashboardGames(newGames);
      fetchDashboard(newGames.map((g) => g.gameId));
    }
  }

  function handleCompareGames(gameIds: number[]) {
    // Add all games to the dashboard tray
    const newGames = [...dashboardGames];
    for (const id of gameIds) {
      if (!newGames.some((g) => g.gameId === id)) {
        // We don't have name/number for these yet — the dashboard API will resolve them
        newGames.push({ gameId: id, gameName: "", gameNumber: "" });
      }
    }
    const trimmed = newGames.slice(0, 4);
    setDashboardGames(trimmed);
    fetchDashboard(trimmed.map((g) => g.gameId));
  }

  function handleRemoveGame(gameId: number) {
    const newGames = dashboardGames.filter((g) => g.gameId !== gameId);
    setDashboardGames(newGames);
    fetchDashboard(newGames.map((g) => g.gameId));
  }

  function handleAskAbout(visual: string) {
    const toolName = VISUAL_TO_TOOL[visual];
    const question = VISUAL_QUESTIONS[visual];
    if (!toolName || !question) return;

    // Set pending tool hint and pre-fill the input
    setPendingToolHint({
      visual,
      toolName,
      gameIds: dashboardGames.map((g) => g.gameId),
    });
    setInput(question);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <main className="flex flex-col h-screen" style={{ background: T.pageBg }}>
      {/* Header — full width */}
      <header className="border-b bg-white px-6 py-4" style={{ borderColor: T.divider }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold" style={{ color: T.textPrimary, fontFamily: T.font }}>
            ScratchSmart
          </h1>
          <div className="flex gap-2">
            {STATES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSelectedState(s);
                  setError("");
                }}
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                style={{
                  background: selectedState === s ? T.textPrimary : T.pageBg,
                  color: selectedState === s ? "#fff" : T.textSecondary,
                  fontFamily: T.font,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Chat */}
        <div
          className="flex flex-col"
          style={{
            width: "33.333%",
            minWidth: 360,
            borderRight: `1px solid ${T.divider}`,
            background: "#fff",
          }}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-6">
              {turns.length === 0 && !loading && (
                <div className="text-center mt-20" style={{ color: T.textTertiary }}>
                  {selectedState
                    ? `Ask a question about ${selectedState} scratch-off games.`
                    : "Select a state to get started."}
                </div>
              )}

              {turns.map((turn, i) => (
                <div key={i} className="space-y-3">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div
                      className="rounded-lg px-4 py-2.5 max-w-[85%]"
                      style={{
                        background: T.textPrimary,
                        color: "#fff",
                        fontSize: T.sizeBody,
                        fontFamily: T.font,
                      }}
                    >
                      {turn.question}
                    </div>
                  </div>

                  {/* Tool trace */}
                  {turn.steps.length > 0 && <ToolTrace steps={turn.steps} />}

                  {/* Assistant answer */}
                  {turn.blocks ? (
                    <div
                      className="border rounded-lg px-4 py-3"
                      style={{ borderColor: T.divider, background: T.cardBg }}
                    >
                      <BlockRenderer
                        blocks={turn.blocks}
                        onChoiceSelect={handleChoiceSelect}
                        onExploreSelect={handleExploreSelect}
                        onExploreGame={handleExploreGame}
                        onCompareGames={handleCompareGames}
                        choicesDisabled={i < turns.length - 1 || loading}
                        dashboardGameIds={dashboardGameIdSet}
                      />
                    </div>
                  ) : turn.answer ? (
                    <div
                      className="border rounded-lg px-4 py-3 prose prose-sm max-w-none"
                      style={{
                        borderColor: T.divider,
                        background: T.cardBg,
                        color: T.textPrimary,
                      }}
                    >
                      <ReactMarkdown
                        components={{
                          hr: () => null,
                          img: ({ src, alt }) => (
                            <img
                              src={src}
                              alt={alt ?? ""}
                              className="not-prose float-left w-14 h-14 object-cover rounded-md border mr-3 mt-1"
                              style={{ borderColor: T.divider }}
                            />
                          ),
                          p: ({ children, ...props }) => {
                            const childArray = Array.isArray(children) ? children : [children];
                            const hasOnlyImg =
                              childArray.length === 1 &&
                              typeof childArray[0] === "object" &&
                              childArray[0] !== null &&
                              "type" in childArray[0] &&
                              childArray[0].type === "img";
                            if (hasOnlyImg) return <>{children}</>;
                            return <p {...props}>{children}</p>;
                          },
                          em: ({ children, ...props }) => {
                            const text = typeof children === "string" ? children : "";
                            if (text.startsWith("Data last updated")) {
                              return (
                                <em
                                  {...props}
                                  style={{
                                    display: "block",
                                    marginTop: 24,
                                    paddingTop: 12,
                                    borderTop: `1px solid ${T.divider}`,
                                    color: T.textTertiary,
                                    fontSize: T.sizeSmall,
                                  }}
                                >
                                  {children}
                                </em>
                              );
                            }
                            return <em {...props}>{children}</em>;
                          },
                        }}
                      >
                        {turn.answer}
                      </ReactMarkdown>
                    </div>
                  ) : null}

                  {/* Usage badge */}
                  <div style={{ fontSize: T.sizeCaption, color: T.textTertiary }}>
                    {turn.usage.input_tokens.toLocaleString()} in /{" "}
                    {turn.usage.output_tokens.toLocaleString()} out /{" "}
                    {turn.usage.iterations} call{turn.usage.iterations !== 1 && "s"}
                    {turn.usage.cache_read_input_tokens > 0 && (
                      <span className="ml-2">
                        (cache: {turn.usage.cache_read_input_tokens.toLocaleString()}{" "}
                        read)
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2" style={{ color: T.textTertiary }}>
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: T.textTertiary }}
                  />
                  Thinking...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="px-4 py-4" style={{ borderTop: `1px solid ${T.divider}` }}>
            {error && (
              <div className="text-sm mb-2" style={{ color: "#ef4444" }}>
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedState
                    ? `Ask about ${selectedState} scratch-off games...`
                    : "Select a state first"
                }
                disabled={loading || !selectedState}
                className="flex-1 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 disabled:text-gray-400"
                style={{
                  border: `1px solid ${T.border}`,
                  fontSize: T.sizeBody,
                  fontFamily: T.font,
                  background: loading || !selectedState ? T.pageBg : T.cardBg,
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !selectedState || !input.trim()}
                className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                style={{
                  background: loading || !selectedState || !input.trim() ? T.border : T.textPrimary,
                  color: "#fff",
                  fontFamily: T.font,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right panel — Dashboard */}
        <div className="flex-1 overflow-hidden">
          <DashboardPanel
            mode={dashboardMode}
            data={dashboardData}
            onRemoveGame={handleRemoveGame}
            onAskAbout={handleAskAbout}
          />
        </div>
      </div>
    </main>
  );
}

// ─── Tool Trace Component ────────────────────────────────────────────────────

function ToolTrace({ steps }: { steps: ToolStep[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ fontSize: T.sizeSmall, fontFamily: T.font }}>
      <button
        onClick={() => setOpen(!open)}
        className="transition-colors"
        style={{ color: T.textTertiary, background: "none", border: "none", cursor: "pointer" }}
      >
        {open ? "▾" : "▸"} {steps.length} tool call
        {steps.length !== 1 && "s"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {steps.map((step, j) => (
            <div
              key={j}
              className="rounded-md px-3 py-2 font-mono"
              style={{
                background: T.pageBg,
                border: `1px solid ${T.divider}`,
                fontSize: T.sizeCaption,
              }}
            >
              <div style={{ fontWeight: 600, color: T.textPrimary }}>
                {step.tool_name}(
                {JSON.stringify(step.tool_input).slice(0, 120)}
                {JSON.stringify(step.tool_input).length > 120 && "..."}
                )
              </div>
              <div className="mt-1 truncate" style={{ color: T.textSecondary }}>
                → {JSON.stringify(step.tool_result).slice(0, 200)}
                {JSON.stringify(step.tool_result).length > 200 && "..."}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
