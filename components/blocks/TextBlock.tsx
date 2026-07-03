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
        {block.content}
      </ReactMarkdown>
    </div>
  );
}
