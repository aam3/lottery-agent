import { mkdir, writeFile } from "fs/promises";
import path from "path";

interface TraceData {
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

const TRACES_DIR = path.join(process.cwd(), "traces");

function sanitizeForFilename(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join("-");
}

export async function writeTrace(data: TraceData): Promise<string> {
  await mkdir(TRACES_DIR, { recursive: true });

  const slug = sanitizeForFilename(data.question);
  const ts = data.timestamp.replace(/[:.]/g, "-");
  const filename = `${ts}_${slug}.json`;
  const filepath = path.join(TRACES_DIR, filename);

  await writeFile(filepath, JSON.stringify(data, null, 2));
  console.log(`[trace] Written to ${filename}`);
  return filepath;
}
