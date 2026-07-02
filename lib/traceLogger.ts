import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

interface TurnTrace {
  timestamp: string;
  state: string;
  question: string;
  steps: Array<{
    tool_name: string;
    tool_input: Record<string, unknown>;
    tool_result: unknown;
  }>;
  answer: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    iterations: number;
  };
  duration_ms: number;
}

interface ConversationTrace {
  conversationId: string;
  startedAt: string;
  turns: TurnTrace[];
}

const TRACES_DIR = path.join(process.cwd(), "traces");

function getFilepath(conversationId: string): string {
  return path.join(TRACES_DIR, `${conversationId}.json`);
}

export async function writeTrace(
  conversationId: string,
  turn: TurnTrace,
): Promise<string> {
  await mkdir(TRACES_DIR, { recursive: true });

  const filepath = getFilepath(conversationId);

  let conversation: ConversationTrace;
  try {
    const existing = await readFile(filepath, "utf-8");
    conversation = JSON.parse(existing);
  } catch {
    conversation = {
      conversationId,
      startedAt: turn.timestamp,
      turns: [],
    };
  }

  conversation.turns.push(turn);

  await writeFile(filepath, JSON.stringify(conversation, null, 2));
  console.log(
    `[trace] Turn ${conversation.turns.length} written to ${conversationId}.json`,
  );
  return filepath;
}
