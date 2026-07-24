"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
}

export function CodeBlock({ code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-[#0a0a0f] rounded-md overflow-hidden border border-[#1e1e2e]">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-[#12121a] hover:bg-[#1a1a2e] border border-[#1e1e2e] rounded-md text-xs font-medium text-gray-300 transition-all duration-fast"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3" /> Copied
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" /> Copy
          </>
        )}
      </button>

      <pre className="p-4 pr-24 overflow-x-auto text-xs font-mono text-gray-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
