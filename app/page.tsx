"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const STATES = ["NJ", "CA", "FL", "NY", "OH"] as const;

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
  answer: string;
  usage: UsageSummary;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  async function handleSend() {
    if (!selectedState) {
      setError("Select a state first.");
      return;
    }
    const trimmed = input.trim();
    if (!trimmed) return;

    setError("");
    setInput("");
    setLoading(true);

    const userMessage = `[State: ${selectedState}] ${trimmed}`;
    const newMessages = [
      ...messages,
      { role: "user" as const, content: userMessage },
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Error: ${res.status}`);
        setLoading(false);
        return;
      }

      setMessages([
        ...newMessages,
        { role: "assistant" as const, content: data.answer },
      ]);
      setTurns([
        ...turns,
        {
          question: trimmed,
          steps: data.steps,
          answer: data.answer,
          usage: data.usage,
        },
      ]);
    } catch {
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <main className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <h1 className="text-lg font-semibold text-gray-900">ScratchSmart</h1>
          <div className="flex gap-2">
            {STATES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSelectedState(s);
                  setError("");
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  selectedState === s
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {turns.length === 0 && !loading && (
            <div className="text-center text-gray-400 mt-20">
              {selectedState
                ? `Ask a question about ${selectedState} scratch-off games.`
                : "Select a state to get started."}
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} className="space-y-3">
              {/* User message */}
              <div className="flex justify-end">
                <div className="bg-gray-900 text-white rounded-lg px-4 py-2.5 max-w-md">
                  {turn.question}
                </div>
              </div>

              {/* Tool trace */}
              {turn.steps.length > 0 && (
                <ToolTrace steps={turn.steps} />
              )}

              {/* Assistant answer */}
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-800 prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    img: ({ src, alt }) => (
                      <img
                        src={src}
                        alt={alt ?? ""}
                        className="not-prose float-left w-14 h-14 object-cover rounded-md border border-gray-200 mr-3 mt-1"
                      />
                    ),
                    p: ({ children, ...props }) => {
                      // If a paragraph contains only an image, render as a plain span
                      // so it doesn't create a block-level gap
                      const childArray = Array.isArray(children) ? children : [children];
                      const hasOnlyImg = childArray.length === 1 &&
                        typeof childArray[0] === "object" &&
                        childArray[0] !== null &&
                        "type" in childArray[0] &&
                        childArray[0].type === "img";
                      if (hasOnlyImg) return <>{children}</>;
                      return <p {...props}>{children}</p>;
                    },
                  }}
                >
                  {turn.answer}
                </ReactMarkdown>
              </div>

              {/* Usage badge */}
              <div className="text-xs text-gray-400">
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
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
              Thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="text-sm text-red-500 mb-2">{error}</div>
          )}
          <div className="flex gap-3">
            <input
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
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={loading || !selectedState || !input.trim()}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Tool Trace Component ────────────────────────────────────────────────────

function ToolTrace({ steps }: { steps: ToolStep[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="text-sm">
      <button
        onClick={() => setOpen(!open)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        {open ? "▾" : "▸"} {steps.length} tool call
        {steps.length !== 1 && "s"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {steps.map((step, j) => (
            <div
              key={j}
              className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 font-mono text-xs"
            >
              <div className="font-semibold text-gray-700">
                {step.tool_name}(
                {JSON.stringify(step.tool_input).slice(0, 120)}
                {JSON.stringify(step.tool_input).length > 120 && "..."}
                )
              </div>
              <div className="text-gray-500 mt-1 truncate">
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
