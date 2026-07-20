"use client";

import { useState, useMemo, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy } from "lucide-react";

/**
 * Design Tokens Reference Page
 * Interactive browser for all design tokens with live previews
 */

interface TokenCategory {
  name: string;
  description: string;
  tokens: Token[];
}

interface Token {
  name: string;
  cssVar: string;
  tailwind?: string;
  value: string;
  category: "colors" | "typography" | "spacing" | "shadows" | "radius" | "breakpoints";
  preview?: string;
}

const COLOR_TOKENS: Token[] = [
  // Background colors
  { name: "Background Root", cssVar: "--wl-bg-root", value: "#0a0a0c", category: "colors", preview: "#0a0a0c" },
  { name: "Background Surface", cssVar: "--wl-bg-surface", value: "#111114", category: "colors", preview: "#111114" },
  { name: "Background Elevated", cssVar: "--wl-bg-elevated", value: "#19191e", category: "colors", preview: "#19191e" },
  { name: "Background Overlay", cssVar: "--wl-bg-overlay", value: "#1f1f26", category: "colors", preview: "#1f1f26" },
  { name: "Background Sunken", cssVar: "--wl-bg-sunken", value: "#07070a", category: "colors", preview: "#07070a" },
  { name: "Background Sidebar", cssVar: "--wl-bg-sidebar", value: "#0c0c10", category: "colors", preview: "#0c0c10" },

  // Neutral colors
  { name: "Neutral 50", cssVar: "--wl-neutral-50", value: "#f8f8fa", category: "colors", preview: "#f8f8fa" },
  { name: "Neutral 100", cssVar: "--wl-neutral-100", value: "#ececf1", category: "colors", preview: "#ececf1" },
  { name: "Neutral 200", cssVar: "--wl-neutral-200", value: "#d5d5dd", category: "colors", preview: "#d5d5dd" },
  { name: "Neutral 300", cssVar: "--wl-neutral-300", value: "#b0b0bf", category: "colors", preview: "#b0b0bf" },
  { name: "Neutral 400", cssVar: "--wl-neutral-400", value: "#8585a0", category: "colors", preview: "#8585a0" },
  { name: "Neutral 500", cssVar: "--wl-neutral-500", value: "#62627e", category: "colors", preview: "#62627e" },
  { name: "Neutral 600", cssVar: "--wl-neutral-600", value: "#4a4a62", category: "colors", preview: "#4a4a62" },
  { name: "Neutral 700", cssVar: "--wl-neutral-700", value: "#35354a", category: "colors", preview: "#35354a" },
  { name: "Neutral 800", cssVar: "--wl-neutral-800", value: "#232336", category: "colors", preview: "#232336" },
  { name: "Neutral 900", cssVar: "--wl-neutral-900", value: "#17172a", category: "colors", preview: "#17172a" },

  // Primary colors (Amber)
  { name: "Primary 50", cssVar: "--blue-50", value: "#fff9eb", category: "colors", preview: "#fff9eb" },
  { name: "Primary 100", cssVar: "--blue-100", value: "#ffefc4", category: "colors", preview: "#ffefc4" },
  { name: "Primary 200", cssVar: "--blue-200", value: "#ffe09d", category: "colors", preview: "#ffe09d" },
  { name: "Primary 300", cssVar: "--blue-300", value: "#ffd06a", category: "colors", preview: "#ffd06a" },
  { name: "Primary 400", cssVar: "--blue-400", value: "#ffc240", category: "colors", preview: "#ffc240" },
  { name: "Primary 500", cssVar: "--blue-500", value: "#f5a623", category: "colors", preview: "#f5a623" },
  { name: "Primary 600", cssVar: "--blue-600", value: "#d98b0a", category: "colors", preview: "#d98b0a" },
  { name: "Primary 700", cssVar: "--blue-700", value: "#b06f05", category: "colors", preview: "#b06f05" },
  { name: "Primary 800", cssVar: "--blue-800", value: "#8d5704", category: "colors", preview: "#8d5704" },
  { name: "Primary 900", cssVar: "--blue-900", value: "#6b4203", category: "colors", preview: "#6b4203" },

  // Semantic colors
  { name: "Success 400", cssVar: "--emerald-500", value: "#34d399", category: "colors", preview: "#34d399" },
  { name: "Success 500", cssVar: "--wl-success-500", value: "#10b981", category: "colors", preview: "#10b981" },
  { name: "Success 600", cssVar: "--wl-success-600", value: "#059669", category: "colors", preview: "#059669" },

  { name: "Warning 400", cssVar: "--amber-500", value: "#fbbf24", category: "colors", preview: "#fbbf24" },
  { name: "Warning 500", cssVar: "--amber-600", value: "#f59e0b", category: "colors", preview: "#f59e0b" },

  { name: "Danger 400", cssVar: "--red-500", value: "#f87171", category: "colors", preview: "#f87171" },
  { name: "Danger 500", cssVar: "--wl-danger-500", value: "#ef4444", category: "colors", preview: "#ef4444" },
  { name: "Danger 600", cssVar: "--wl-danger-600", value: "#dc2626", category: "colors", preview: "#dc2626" },

  { name: "Info 400", cssVar: "--blue-500", value: "#60a5fa", category: "colors", preview: "#60a5fa" },
  { name: "Info 500", cssVar: "--blue-600", value: "#3b82f6", category: "colors", preview: "#3b82f6" },

  // Text colors
  { name: "Text Primary", cssVar: "--wl-text-primary", value: "#f0f0f5", category: "colors", preview: "#f0f0f5" },
  { name: "Text Secondary", cssVar: "--wl-text-secondary", value: "#9494ac", category: "colors", preview: "#9494ac" },
  { name: "Text Tertiary", cssVar: "--wl-text-tertiary", value: "#5e5e78", category: "colors", preview: "#5e5e78" },
  { name: "Text Inverse", cssVar: "--wl-text-inverse", value: "#0a0a0c", category: "colors", preview: "#0a0a0c" },
];

const TYPOGRAPHY_TOKENS: Token[] = [
  { name: "Font Sans", cssVar: "--wl-font-sans", value: "DM Sans, system fonts", category: "typography" },
  { name: "Font Mono", cssVar: "--wl-font-mono", value: "JetBrains Mono, monospace", category: "typography" },

  { name: "Text XS", cssVar: "--wl-text-xs", value: "0.6875rem (11px)", tailwind: "text-xs", category: "typography" },
  { name: "Text SM", cssVar: "--wl-text-sm", value: "0.8125rem (13px)", tailwind: "text-sm", category: "typography" },
  { name: "Text Base", cssVar: "--wl-text-base", value: "0.875rem (14px)", tailwind: "text-base", category: "typography" },
  { name: "Text MD", cssVar: "--wl-text-md", value: "0.9375rem (15px)", category: "typography" },
  { name: "Text LG", cssVar: "--wl-text-lg", value: "1.0625rem (17px)", tailwind: "text-lg", category: "typography" },
  { name: "Text XL", cssVar: "--wl-text-xl", value: "1.25rem (20px)", tailwind: "text-xl", category: "typography" },
  { name: "Text 2XL", cssVar: "--wl-text-2xl", value: "1.5rem (24px)", tailwind: "text-2xl", category: "typography" },
  { name: "Text 3XL", cssVar: "--wl-text-3xl", value: "1.875rem (30px)", tailwind: "text-3xl", category: "typography" },
];

const SPACING_TOKENS: Token[] = [
  { name: "Space 0", cssVar: "--wl-space-0", value: "0", tailwind: "space-0", category: "spacing" },
  { name: "Space 1", cssVar: "--wl-space-1", value: "0.25rem (4px)", tailwind: "space-1", category: "spacing" },
  { name: "Space 2", cssVar: "--wl-space-2", value: "0.5rem (8px)", tailwind: "space-2", category: "spacing" },
  { name: "Space 3", cssVar: "--wl-space-3", value: "0.75rem (12px)", tailwind: "space-3", category: "spacing" },
  { name: "Space 4", cssVar: "--wl-space-4", value: "1rem (16px)", tailwind: "space-4", category: "spacing" },
  { name: "Space 5", cssVar: "--wl-space-5", value: "1.25rem (20px)", tailwind: "space-5", category: "spacing" },
  { name: "Space 6", cssVar: "--wl-space-6", value: "1.5rem (24px)", tailwind: "space-6", category: "spacing" },
  { name: "Space 8", cssVar: "--wl-space-8", value: "2rem (32px)", tailwind: "space-8", category: "spacing" },
  { name: "Space 10", cssVar: "--wl-space-10", value: "2.5rem (40px)", tailwind: "space-10", category: "spacing" },
  { name: "Space 12", cssVar: "--wl-space-12", value: "3rem (48px)", tailwind: "space-12", category: "spacing" },
];

const RADIUS_TOKENS: Token[] = [
  { name: "Radius SM", cssVar: "--wl-radius-sm", value: "4px", tailwind: "rounded-sm", category: "radius" },
  { name: "Radius MD", cssVar: "--wl-radius-md", value: "6px", tailwind: "rounded-md", category: "radius" },
  { name: "Radius LG", cssVar: "--wl-radius-lg", value: "10px", tailwind: "rounded-lg", category: "radius" },
  { name: "Radius XL", cssVar: "--wl-radius-xl", value: "14px", tailwind: "rounded-xl", category: "radius" },
  { name: "Radius Full", cssVar: "--wl-radius-full", value: "9999px", tailwind: "rounded-full", category: "radius" },
];

const SHADOW_TOKENS: Token[] = [
  { name: "Shadow SM", cssVar: "--wl-shadow-sm", value: "0 1px 2px rgba(0, 0, 0, 0.3)", tailwind: "shadow-sm", category: "shadows" },
  { name: "Shadow MD", cssVar: "--wl-shadow-md", value: "0 2px 8px rgba(0, 0, 0, 0.4)", tailwind: "shadow-md", category: "shadows" },
  { name: "Shadow LG", cssVar: "--wl-shadow-lg", value: "0 8px 24px rgba(0, 0, 0, 0.5)", tailwind: "shadow-lg", category: "shadows" },
  { name: "Shadow Glow", cssVar: "--wl-shadow-glow", value: "0 0 20px rgba(245, 166, 35, 0.15)", category: "shadows" },
];

const BREAKPOINT_TOKENS: Token[] = [
  { name: "Mobile", cssVar: "sm", value: "640px", category: "breakpoints" },
  { name: "Tablet", cssVar: "md", value: "768px", category: "breakpoints" },
  { name: "Desktop", cssVar: "lg", value: "1024px", category: "breakpoints" },
  { name: "Wide", cssVar: "xl", value: "1280px", category: "breakpoints" },
  { name: "Ultra Wide", cssVar: "2xl", value: "1536px", category: "breakpoints" },
];

const ALL_TOKENS: Token[] = [
  ...COLOR_TOKENS,
  ...TYPOGRAPHY_TOKENS,
  ...SPACING_TOKENS,
  ...RADIUS_TOKENS,
  ...SHADOW_TOKENS,
  ...BREAKPOINT_TOKENS,
];

interface CopyState {
  [key: string]: boolean;
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <div
      className="w-full h-20 rounded-lg border border-wl-border-default transition-all hover:border-wl-border-strong"
      style={{ backgroundColor: color }}
    />
  );
}

function ShadowPreview({ shadow }: { shadow: string }) {
  return (
    <div
      className="w-full h-20 bg-wl-bg-surface rounded-lg border border-wl-border-default"
      style={{ boxShadow: shadow }}
    />
  );
}

function RadiusPreview({ radius }: { radius: string }) {
  return (
    <div
      className="w-full h-20 bg-gradient-to-br from-blue-500 to-blue-600 border border-wl-border-default"
      style={{ borderRadius: radius }}
    />
  );
}

function SpacingBar({ size, value }: { size: string; value: string }) {
  const pxValue = value.replace("rem", "").replace("px", "");
  const numValue = parseFloat(pxValue) * 16; // Convert rem to px

  return (
    <div className="space-y-2">
      <div
        className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-sm transition-all"
        style={{ height: "24px", width: `${Math.min(numValue * 2, 100)}%` }}
      />
      <div className="text-xs text-wl-text-secondary">{size}</div>
    </div>
  );
}

function TypographyPreview({ size }: { size: string }) {
  const sizeMap: Record<string, string> = {
    "text-xs": "text-xs",
    "text-sm": "text-sm",
    "text-base": "text-base",
    "text-lg": "text-lg",
    "text-xl": "text-xl",
    "text-2xl": "text-2xl",
    "text-3xl": "text-3xl",
  };

  return (
    <div className={cn("font-sans text-white", sizeMap[size] || "text-base")}>
      The quick brown fox jumps over the lazy dog
    </div>
  );
}

export default function DesignTokensPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [copiedTokens, setCopiedTokens] = useState<CopyState>({});

  const filteredTokens = useMemo(() => {
    return ALL_TOKENS.filter((token) =>
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.cssVar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.value.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const groupedTokens = useMemo(() => {
    const grouped: Record<string, Token[]> = {
      colors: [],
      typography: [],
      spacing: [],
      shadows: [],
      radius: [],
      breakpoints: [],
    };

    filteredTokens.forEach((token) => {
      grouped[token.category].push(token);
    });

    return grouped;
  }, [filteredTokens]);

  const handleCopy = (text: string, tokenId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTokens({ ...copiedTokens, [tokenId]: true });
    setTimeout(() => {
      setCopiedTokens({ ...copiedTokens, [tokenId]: false });
    }, 2000);
  };

  const categories = [
    {
      id: "colors",
      name: "Colors",
      description: "Color palette with all primary, neutral, and semantic colors",
      tokens: groupedTokens.colors,
      icon: "🎨",
    },
    {
      id: "typography",
      name: "Typography",
      description: "Font families, sizes, and text styles",
      tokens: groupedTokens.typography,
      icon: "🔤",
    },
    {
      id: "spacing",
      name: "Spacing",
      description: "Spacing scale from 0 to 3rem",
      tokens: groupedTokens.spacing,
      icon: "📏",
    },
    {
      id: "radius",
      name: "Border Radius",
      description: "Border radius scale for components",
      tokens: groupedTokens.radius,
      icon: "⭕",
    },
    {
      id: "shadows",
      name: "Shadows",
      description: "Shadow depths for elevation",
      tokens: groupedTokens.shadows,
      icon: "🌑",
    },
    {
      id: "breakpoints",
      name: "Breakpoints",
      description: "Responsive design breakpoints",
      tokens: groupedTokens.breakpoints,
      icon: "📱",
    },
  ];

  return (
    <div className="min-h-screen bg-wl-bg-root text-white">
      {/* Header */}
      <div className="border-b border-wl-border-default sticky top-0 z-40 bg-wl-bg-root/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Design Tokens</h1>
            <p className="text-wl-neutral-300">Complete reference of all design system tokens</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Input
              placeholder="Search tokens by name, variable, or value..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full bg-wl-bg-surface border-wl-border-default text-white placeholder-wl-text-secondary"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {categories.map((category) => (
          <div key={category.id} className="mb-16">
            {/* Category Header */}
            <button
              onClick={() =>
                setExpandedCategory(
                  expandedCategory === category.id ? null : category.id
                )
              }
              className={cn(
                "w-full flex items-center gap-3 mb-6 p-4 rounded-lg",
                "bg-wl-bg-surface border border-wl-border-default",
                "hover:border-wl-border-default transition-colors",
                expandedCategory === category.id && "border-wl-info-500/30 bg-wl-info-bg"
              )}
            >
              <span className="text-2xl">{category.icon}</span>
              <div className="text-left flex-1">
                <h2 className="text-lg font-semibold">{category.name}</h2>
                <p className="text-sm text-wl-neutral-300">{category.description}</p>
              </div>
              <span
                className={cn(
                  "text-wl-text-secondary transition-transform",
                  expandedCategory === category.id && "rotate-180"
                )}
              >
                ▼
              </span>
            </button>

            {/* Category Content */}
            {expandedCategory === category.id && category.tokens.length > 0 && (
              <div className="space-y-4 pl-4">
                {category.id === "colors" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {category.tokens.map((token) => (
                      <div
                        key={token.cssVar}
                        className="rounded-lg border border-wl-border-default p-4 bg-wl-bg-surface hover:border-wl-border-default transition-colors"
                      >
                        <div className="mb-3">
                          <ColorSwatch color={token.preview || token.value} />
                        </div>
                        <div className="space-y-2">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {token.name}
                            </div>
                            <div className="text-xs text-wl-text-secondary font-mono">
                              {token.value}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopy(token.cssVar, token.cssVar)}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs",
                                "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong",
                                "transition-colors",
                                copiedTokens[token.cssVar] && "bg-wl-success-500/20 border-wl-success-500"
                              )}
                            >
                              {copiedTokens[token.cssVar] ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  CSS Var
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleCopy(token.value, `${token.cssVar}-value`)}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs",
                                "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong",
                                "transition-colors",
                                copiedTokens[`${token.cssVar}-value`] && "bg-wl-success-500/20 border-wl-success-500"
                              )}
                            >
                              {copiedTokens[`${token.cssVar}-value`] ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Value
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {category.id === "typography" && (
                  <div className="space-y-4">
                    {category.tokens.map((token) => (
                      <div
                        key={token.cssVar}
                        className="rounded-lg border border-wl-border-default p-4 bg-wl-bg-surface hover:border-wl-border-default transition-colors"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-semibold text-white mb-2">
                              {token.name}
                            </div>
                            <div className="text-xs text-wl-text-secondary space-y-1 font-mono">
                              <div>{token.cssVar}</div>
                              <div className="text-wl-neutral-300">{token.value}</div>
                              {token.tailwind && <div>{token.tailwind}</div>}
                            </div>
                          </div>
                          {token.tailwind && (
                            <div className="flex items-center">
                              <TypographyPreview size={token.tailwind} />
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleCopy(token.cssVar, token.cssVar)}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs",
                              "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong",
                              "transition-colors",
                              copiedTokens[token.cssVar] && "bg-wl-success-500/20 border-wl-success-500"
                            )}
                          >
                            {copiedTokens[token.cssVar] ? (
                              <>
                                <Check className="w-3 h-3" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                CSS Var
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {category.id === "spacing" && (
                  <div className="space-y-4">
                    {category.tokens.map((token) => (
                      <div
                        key={token.cssVar}
                        className="rounded-lg border border-wl-border-default p-4 bg-wl-bg-surface hover:border-wl-border-default transition-colors"
                      >
                        <div className="mb-3">
                          <div className="text-sm font-semibold text-white mb-2">
                            {token.name}
                          </div>
                          <div className="text-xs text-wl-text-secondary font-mono mb-3">
                            {token.value}
                          </div>
                          <SpacingBar size={token.value} value={token.value} />
                        </div>

                        <button
                          onClick={() => handleCopy(token.cssVar, token.cssVar)}
                          className={cn(
                            "w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs",
                            "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong",
                            "transition-colors",
                            copiedTokens[token.cssVar] && "bg-wl-success-500/20 border-wl-success-500"
                          )}
                        >
                          {copiedTokens[token.cssVar] ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy CSS Variable
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {category.id === "radius" && (
                  <div className="space-y-4">
                    {category.tokens.map((token) => (
                      <div
                        key={token.cssVar}
                        className="rounded-lg border border-wl-border-default p-4 bg-wl-bg-surface hover:border-wl-border-default transition-colors"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-semibold text-white mb-2">
                              {token.name}
                            </div>
                            <div className="text-xs text-wl-text-secondary font-mono space-y-1">
                              <div>{token.cssVar}</div>
                              <div className="text-wl-neutral-300">{token.value}</div>
                              {token.tailwind && <div>{token.tailwind}</div>}
                            </div>
                          </div>
                          <RadiusPreview radius={token.value} />
                        </div>

                        <button
                          onClick={() => handleCopy(token.cssVar, token.cssVar)}
                          className={cn(
                            "w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs mt-3",
                            "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong",
                            "transition-colors",
                            copiedTokens[token.cssVar] && "bg-wl-success-500/20 border-wl-success-500"
                          )}
                        >
                          {copiedTokens[token.cssVar] ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy CSS Variable
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {category.id === "shadows" && (
                  <div className="space-y-4">
                    {category.tokens.map((token) => (
                      <div
                        key={token.cssVar}
                        className="rounded-lg border border-wl-border-default p-4 bg-wl-bg-surface hover:border-wl-border-default transition-colors"
                      >
                        <div className="mb-3">
                          <div className="text-sm font-semibold text-white mb-2">
                            {token.name}
                          </div>
                          <div className="text-xs text-wl-text-secondary font-mono mb-3">
                            {token.value}
                          </div>
                          <ShadowPreview shadow={token.value} />
                        </div>

                        <button
                          onClick={() => handleCopy(token.cssVar, token.cssVar)}
                          className={cn(
                            "w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs",
                            "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong",
                            "transition-colors",
                            copiedTokens[token.cssVar] && "bg-wl-success-500/20 border-wl-success-500"
                          )}
                        >
                          {copiedTokens[token.cssVar] ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy CSS Variable
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {category.id === "breakpoints" && (
                  <div className="space-y-4">
                    {category.tokens.map((token) => (
                      <div
                        key={token.cssVar}
                        className="rounded-lg border border-wl-border-default p-4 bg-wl-bg-surface hover:border-wl-border-default transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {token.name}
                            </div>
                            <div className="text-xs text-wl-text-secondary font-mono">
                              {token.value}
                            </div>
                          </div>
                          <div className="h-1 flex-1 mx-4 bg-gradient-to-r from-blue-500/50 to-blue-500 rounded-full" />
                        </div>

                        <button
                          onClick={() => handleCopy(token.cssVar, token.cssVar)}
                          className={cn(
                            "w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs",
                            "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong",
                            "transition-colors",
                            copiedTokens[token.cssVar] && "bg-wl-success-500/20 border-wl-success-500"
                          )}
                        >
                          {copiedTokens[token.cssVar] ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Breakpoint
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {expandedCategory === category.id && category.tokens.length === 0 && (
              <div className="text-center py-8 text-wl-text-secondary">
                No tokens found matching your search
              </div>
            )}
          </div>
        ))}

        {filteredTokens.length === 0 && (
          <div className="text-center py-12">
            <p className="text-wl-text-secondary mb-4">No tokens found matching your search</p>
            <Button
              variant="secondary"
              onClick={() => setSearchQuery("")}
            >
              Clear Search
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
