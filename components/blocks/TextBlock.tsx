"use client";

import ReactMarkdown from "react-markdown";
import { T } from "@/lib/tokens";
import type { TextBlock as TextBlockType } from "./types";

export default function TextBlock({ block }: { block: TextBlockType }) {
  return (
    <div
      className="prose prose-sm max-w-none"
      style={{
        fontFamily: T.font,
        color: T.textPrimary,
      }}
    >
      <ReactMarkdown
        components={{
          hr: () => null,
        }}
      >
        {block.content}
      </ReactMarkdown>
    </div>
  );
}
