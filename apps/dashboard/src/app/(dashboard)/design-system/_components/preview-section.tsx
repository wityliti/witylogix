"use client";

import { useState } from "react";
import { Eye, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

interface PreviewSectionProps {
  title: string;
  description: string;
  preview: React.ReactNode;
  code: string;
}

export function PreviewSection({
  title,
  description,
  preview,
  code,
}: PreviewSectionProps) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-md p-6 flex items-center justify-center min-h-24">
        {preview}
      </div>

      <button
        onClick={() => setShowCode(!showCode)}
        className="flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-white transition-colors"
      >
        {showCode ? (
          <>
            <Eye className="w-3 h-3" /> Hide Code
          </>
        ) : (
          <>
            <Code className="w-3 h-3" /> Show Code
          </>
        )}
      </button>

      {showCode && <CodeBlock code={code} />}
    </div>
  );
}
