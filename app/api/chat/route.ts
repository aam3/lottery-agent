// Phase 2: Agent loop API route
// Receives user message, runs tool-use loop with Claude, returns { steps, answer }
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Not implemented — see Phase 2" },
    { status: 501 },
  );
}
