import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runAgentLoop } from "@/lib/agentLoop";

export async function POST(request: Request) {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

  // Validate messages array
  const { messages } = body as {
    messages?: Array<{ role: string; content: string }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages must be a non-empty array" },
      { status: 400 },
    );
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") {
    return NextResponse.json(
      { error: "Last message must have role 'user'" },
      { status: 400 },
    );
  }

  for (const msg of messages) {
    if (
      (msg.role !== "user" && msg.role !== "assistant") ||
      typeof msg.content !== "string" ||
      msg.content.trim() === ""
    ) {
      return NextResponse.json(
        {
          error:
            "Each message must have role 'user' or 'assistant' and non-empty content",
        },
        { status: 400 },
      );
    }
  }

  // Convert to Anthropic message format
  const apiMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // Run the agent loop
  try {
    const result = await runAgentLoop({ messages: apiMessages });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[chat route] Error:", err);

    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited — try again in a moment" },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "API authentication failed" },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `API error: ${err.message}` },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
