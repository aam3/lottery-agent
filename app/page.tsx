"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import BlockRenderer from "@/components/blocks/BlockRenderer";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import type { DashboardData, DashboardMode } from "@/components/dashboard/DashboardPanel";
import type { Block } from "@/components/blocks/types";
import { T } from "@/lib/tokens";

const STATES: { abbr: string; name: string }[] = [
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "CA", name: "California" },
  { abbr: "FL", name: "Florida" },
  { abbr: "NY", name: "New York" },
  { abbr: "OH", name: "Ohio" },
];

const VISUAL_TO_TOOL: Record<string, string> = {
  stats_table: "query_games",
  odds_chart: "get_marginal_odds",
  outcome_bars: "get_outcome_probabilities",
  scatter: "get_risk_reward",
};

const VISUAL_QUESTIONS: Record<string, string> = {
  stats_table: "Which game is the best value?",
  odds_chart: "Which prizes are most likely?",
  outcome_bars: "What are my chances of winning?",
  scatter: "Best risk/reward tradeoff?",
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
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const stateDropdownRef = useRef<HTMLDivElement>(null);
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
  // Stashed prompt from choices block when user clicks "Something else"
  const [pendingChoicePrompt, setPendingChoicePrompt] = useState<string | null>(null);

  // Set of game IDs currently on the dashboard — drives "+ Explore" / "✓" toggle
  const dashboardGameIdSet = useMemo(
    () => new Set(dashboardGames.map((g) => g.gameId)),
    [dashboardGames],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  // Close state dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target as Node)) {
        setStateDropdownOpen(false);
      }
    }
    if (stateDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [stateDropdownOpen]);

  function handleStateChange(abbr: string) {
    if (abbr === selectedState) {
      setStateDropdownOpen(false);
      return;
    }
    if (turns.length > 0) {
      const confirmed = window.confirm(
        `Switch to ${STATES.find((s) => s.abbr === abbr)?.name}? This will reset your current conversation.`
      );
      if (!confirmed) {
        setStateDropdownOpen(false);
        return;
      }
    }
    setSelectedState(abbr);
    setStateDropdownOpen(false);
    setMessages([]);
    setTurns([]);
    setDashboardGames([]);
    setDashboardMode("empty");
    setDashboardData(null);
    setError("");
    setInput("");
    setPendingToolHint(null);
    setPendingChoicePrompt(null);
    conversationIdRef.current = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

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

  async function sendMessage(text: string, displayText?: string) {
    if (!selectedState) {
      setError("Select a state first.");
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;

    setError("");
    setInput("");
    setLoading(true);

    // Show user message immediately as a pending turn
    const pendingTurn: Turn = {
      question: displayText?.trim() || trimmed,
      steps: [],
      usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, iterations: 0 },
    };
    const turnsWithPending = [...turns, pendingTurn];
    setTurns(turnsWithPending);

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
        // Remove the pending turn on error
        setTurns(turns);
        setLoading(false);
        return;
      }

      const assistantContent = data.answer ?? "[structured response]";
      setMessages([
        ...newMessages,
        { role: "assistant" as const, content: assistantContent },
      ]);
      // Replace the pending turn with the complete turn
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
      setTurns(turns); // Remove the pending turn
    } finally {
      setLoading(false);
    }
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleSend() {
    if (pendingChoicePrompt) {
      const prompt = pendingChoicePrompt;
      setPendingChoicePrompt(null);
      sendMessage(`${prompt} ${input}`, input);
    } else {
      sendMessage(input);
    }
  }

  function handleChoiceSelect(choice: string, prompt: string) {
    if (choice.toLowerCase() === "something else") {
      setPendingChoicePrompt(prompt);
      inputRef.current?.focus();
      return;
    }
    sendMessage(`${prompt} ${choice}`, choice);
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
          setDashboardGames(newGames.slice(0, 5));
          // Re-fetch with all tray game IDs for combined view
          if (newGames.length > 1 && !alreadyInTray) {
            fetchDashboard(newGames.slice(0, 5).map((g) => g.gameId));
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

    if (newGames.length > 5) {
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
    const trimmed = newGames.slice(0, 5);
    setDashboardGames(trimmed);
    fetchDashboard(trimmed.map((g) => g.gameId));
  }

  function handleRemoveGame(gameId: number) {
    const newGames = dashboardGames.filter((g) => g.gameId !== gameId);
    setDashboardGames(newGames);
    fetchDashboard(newGames.map((g) => g.gameId));
  }

  function handleAskAbout(visual: string, questionOverride?: string) {
    const toolName = VISUAL_TO_TOOL[visual];
    const question = questionOverride || VISUAL_QUESTIONS[visual];
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
      {/* Header — branded navbar */}
      <header
        style={{
          height: 48,
          background: T.navBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          flexShrink: 0,
          position: "relative",
          zIndex: 50,
        }}
      >
        <h1
          style={{
            fontFamily: T.fontLogo,
            fontSize: 17,
            color: T.navLogoScratch,
            letterSpacing: -0.3,
            lineHeight: 1,
          }}
        >
          Scratch<span style={{ color: T.navLogoSmart }}>Smart</span>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span
            style={{
              fontSize: T.sizeSmall,
              fontWeight: T.weightLabel,
              fontFamily: T.font,
              color: T.navInactiveText,
              cursor: "pointer",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.navCtaBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.navInactiveText; }}
          >
            About
          </span>
          <span
            style={{
              fontSize: T.sizeSmall,
              fontWeight: T.weightLabel,
              fontFamily: T.font,
              color: T.navInactiveText,
              background: "transparent",
              padding: "5px 14px",
              borderRadius: T.smallRadius,
              border: "1px solid rgba(255,255,255,0.4)",
              cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = T.navCtaBg;
              e.currentTarget.style.borderColor = "rgba(254,231,136,0.5)";
              e.currentTarget.style.background = "rgba(254,231,136,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = T.navInactiveText;
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            Log In
          </span>
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
            boxShadow: "3px 0 8px rgba(0,0,0,0.05)",
            background: "#fff",
            position: "relative" as const,
            zIndex: 1,
          }}
        >
          {/* State header bar */}
          {selectedState && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                borderBottom: `1px solid ${T.divider}`,
                background: T.cardBg,
                gap: 8,
                flexShrink: 0,
                position: "relative",
              }}
              ref={stateDropdownRef}
            >
              <span
                style={{
                  fontSize: T.sizeLabel,
                  fontWeight: T.weightLabel,
                  color: T.textSecondary,
                  letterSpacing: 0.5,
                  textTransform: "uppercase" as const,
                }}
              >
                Browsing
              </span>
              <button
                onClick={() => setStateDropdownOpen(!stateDropdownOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: T.sizeBody,
                  fontWeight: T.weightTitle,
                  color: T.accent,
                  fontFamily: T.font,
                  cursor: "pointer",
                }}
              >
                {STATES.find((s) => s.abbr === selectedState)?.name}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginTop: 1 }}>
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* State dropdown */}
              {stateDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 16,
                    marginTop: 4,
                    background: T.cardBg,
                    borderRadius: T.cardRadius,
                    boxShadow: T.dropdownShadow,
                    border: `1px solid ${T.divider}`,
                    zIndex: 100,
                    minWidth: 180,
                    overflow: "hidden",
                  }}
                >
                  {STATES.map((s) => (
                    <button
                      key={s.abbr}
                      onClick={() => handleStateChange(s.abbr)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "9px 16px",
                        border: "none",
                        background: s.abbr === selectedState ? T.accent : "transparent",
                        color: s.abbr === selectedState ? "#fff" : T.textPrimary,
                        fontSize: T.sizeBody,
                        fontWeight: T.weightLabel,
                        fontFamily: T.font,
                        cursor: "pointer",
                        textAlign: "left" as const,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (s.abbr !== selectedState) {
                          (e.target as HTMLButtonElement).style.background = T.hoverBg;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (s.abbr !== selectedState) {
                          (e.target as HTMLButtonElement).style.background = "transparent";
                        }
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-6">
              {/* Welcome message after state selection */}
              {selectedState && (
                <div className="space-y-3">
                  <div
                    className="px-4 py-3"
                    style={{ border: `1px solid ${T.divider}`, borderRadius: T.cardRadius, background: T.agentBubbleBg }}
                  >
                    <div style={{
                      fontSize: T.sizeBody,
                      color: T.textPrimary,
                      fontFamily: T.font,
                      lineHeight: T.lhBody,
                    }}>
                      How can I help you explore {STATES.find((s) => s.abbr === selectedState)?.name} scratch-off games?
                    </div>
                  </div>
                </div>
              )}

              {turns.map((turn, i) => (
                <div key={i} className="space-y-3">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div
                      className="px-4 py-2.5 max-w-[85%]"
                      style={{
                        borderRadius: T.cardRadius,
                        background: T.accent,
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
                      className="px-4 py-3"
                      style={{ border: `1px solid ${T.divider}`, borderRadius: T.cardRadius, background: T.agentBubbleBg, overflowX: "auto" }}
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
                      className="px-4 py-3 prose prose-sm max-w-none"
                      style={{
                        border: `1px solid ${T.divider}`,
                        borderRadius: T.cardRadius,
                        background: T.agentBubbleBg,
                        color: T.textPrimary,
                        overflowX: "auto",
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
                <div className="flex items-center gap-2" style={{ color: T.textTertiary, fontFamily: T.font, fontSize: T.sizeBody }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: `2px solid ${T.border}`,
                      borderTopColor: T.accent,
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
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
                    ? `Ask about ${STATES.find((s) => s.abbr === selectedState)?.name} scratch-off games...`
                    : "Select a state above to get started"
                }
                disabled={loading || !selectedState}
                className="flex-1 px-4 py-2.5 focus:outline-none focus:ring-2 disabled:text-gray-400"
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: T.cardRadius,
                  fontSize: T.sizeBody,
                  fontFamily: T.font,
                  background: loading || !selectedState ? T.pageBg : T.cardBg,
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !selectedState || !input.trim()}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: loading || !selectedState || !input.trim() ? T.textTertiary : T.accent,
                  color: "#fff",
                  fontSize: T.sizeSmall,
                  fontWeight: T.weightLabel,
                  fontFamily: T.font,
                  letterSpacing: 0.3,
                  cursor: loading || !selectedState || !input.trim() ? "default" : "pointer",
                  opacity: loading || !selectedState || !input.trim() ? 0.5 : 1,
                  transition: "background 0.15s, opacity 0.15s",
                  flexShrink: 0,
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
      {/* State selection modal — shown when no state selected */}
      {!selectedState && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(44, 41, 36, 0.3)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: T.cardBg,
              borderRadius: T.modalRadius,
              boxShadow: T.modalShadow,
              padding: "36px 44px 40px",
              maxWidth: 420,
              width: "100%",
            }}
          >
            {/* Scratch-mark logo */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div
              style={{
                display: "inline-block",
                position: "relative",
                fontFamily: T.fontLogo,
                fontSize: 24,
                color: "#fff",
                letterSpacing: -0.3,
                lineHeight: 1,
                padding: "8px 18px 10px",
                isolation: "isolate" as const,
              }}
            >
              <span style={{ position: "relative", zIndex: 1 }}>Scratch</span>
              <span style={{ position: "relative", zIndex: 1, color: T.navLogoSmart }}>Smart</span>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: T.accent,
                  borderRadius: "4px 16px 6px 14px",
                  transform: "rotate(-0.8deg) skewX(-1.5deg)",
                  zIndex: 0,
                }}
              />
            </div>
            </div>

            <div
              style={{
                fontSize: 14,
                color: T.textPrimary,
                fontWeight: T.weightTitle,
                marginBottom: 4,
                fontFamily: T.font,
              }}
            >
              Welcome!
            </div>
            <div
              style={{
                fontSize: T.sizeBody,
                color: T.textSecondary,
                marginBottom: 30,
                lineHeight: T.lhBody,
                fontFamily: T.font,
              }}
            >
              Pick your state and I&apos;ll help you find the best scratch-off games to play.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STATES.map((s) => (
                <button
                  key={s.abbr}
                  onClick={() => {
                    setSelectedState(s.abbr);
                    setError("");
                  }}
                  style={{
                    width: "100%",
                    padding: "11px 18px",
                    borderRadius: T.cardRadius,
                    border: `1px solid ${T.border}`,
                    background: T.cardBg,
                    color: T.textPrimary,
                    fontSize: T.sizeBody,
                    fontWeight: T.weightLabel,
                    fontFamily: T.font,
                    cursor: "pointer",
                    textAlign: "left" as const,
                    transition: "background 0.15s, border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLButtonElement).style.borderColor = T.accent;
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.borderColor = T.border;
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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
