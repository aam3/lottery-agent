import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { systemPrompt } from "@/lib/systemPrompt";
import { toolDefinitions } from "@/lib/toolDefs";
import { toolHandlers } from "@/lib/tools";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolStep {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_result: unknown;
}

export interface UsageSummary {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  iterations: number;
}

// ─── Cached system prompt and tools ──────────────────────────────────────────

const cachedSystem: Anthropic.TextBlockParam[] = [
  {
    type: "text",
    text: systemPrompt,
    cache_control: { type: "ephemeral" },
  },
];

const cachedTools = toolDefinitions.map((tool, i) =>
  i === toolDefinitions.length - 1
    ? { ...tool, cache_control: { type: "ephemeral" } as const }
    : tool,
);

// ─── Agent loop ──────────────────────────────────────────────────────────────

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5";
const DEFAULT_MAX_ITERATIONS = 10;

export async function runAgentLoop(params: {
  messages: Anthropic.MessageParam[];
  model?: string;
  maxIterations?: number;
}): Promise<{
  steps: ToolStep[];
  answer: string;
  usage: UsageSummary;
}> {
  const model = params.model ?? DEFAULT_MODEL;
  const maxIterations = params.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const messages: Anthropic.MessageParam[] = [...params.messages];
  const steps: ToolStep[] = [];
  const usage: UsageSummary = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    iterations: 0,
  };

  for (let i = 0; i < maxIterations; i++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: cachedSystem,
      tools: cachedTools,
      messages,
    });

    // Accumulate usage
    usage.input_tokens += response.usage.input_tokens;
    usage.output_tokens += response.usage.output_tokens;
    usage.cache_creation_input_tokens +=
      (response.usage as unknown as Record<string, number>)
        .cache_creation_input_tokens ?? 0;
    usage.cache_read_input_tokens +=
      (response.usage as unknown as Record<string, number>)
        .cache_read_input_tokens ?? 0;
    usage.iterations += 1;

    // If the model is done, extract the text answer
    if (response.stop_reason === "end_turn") {
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      const answer = textBlocks.map((b) => b.text).join("\n");

      console.log(
        `[agent-loop] Done. ${usage.iterations} iteration(s), ` +
          `${usage.input_tokens} in / ${usage.output_tokens} out, ` +
          `cache: ${usage.cache_read_input_tokens} read / ${usage.cache_creation_input_tokens} created`,
      );

      return { steps, answer, usage };
    }

    // If the model wants to use tools, execute them
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      // Append assistant message (must include all content blocks)
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const handler = toolHandlers[toolUse.name];
        let result: unknown;

        if (!handler) {
          result = { error: `Unknown tool: ${toolUse.name}` };
        } else {
          try {
            result = await handler(
              toolUse.input as Record<string, unknown>,
            );
          } catch (err) {
            result = {
              error: `Tool execution error: ${(err as Error).message}`,
            };
          }
        }

        steps.push({
          tool_name: toolUse.name,
          tool_input: toolUse.input as Record<string, unknown>,
          tool_result: result,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });

        console.log(
          `[agent-loop] iteration ${usage.iterations}: ${toolUse.name}(${JSON.stringify(toolUse.input).slice(0, 100)}) → ${JSON.stringify(result).slice(0, 100)}`,
        );
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason — break with whatever we have
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return {
      steps,
      answer:
        textBlocks.map((b) => b.text).join("\n") ||
        `Unexpected stop reason: ${response.stop_reason}`,
      usage,
    };
  }

  // Hit max iterations
  console.log(
    `[agent-loop] Hit max iterations (${maxIterations}). Returning partial result.`,
  );
  return {
    steps,
    answer:
      "I reached the maximum number of tool calls for this turn. Here's what I found so far based on the data retrieved above.",
    usage,
  };
}
