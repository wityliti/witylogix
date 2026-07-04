"use client";

import {
  forwardRef,
  useState,
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface Command {
  group: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  description?: string;
  action: () => void;
}

interface CommandPaletteProps extends HTMLAttributes<HTMLDivElement> {
  commands: Command[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const groupOrder: Record<string, number> = {
  Pages: 0,
  Actions: 1,
  Recent: 2,
};

const CommandPalette = forwardRef<HTMLDivElement, CommandPaletteProps>(
  (
    { commands, open: controlledOpen, onOpenChange, className, ...props },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(controlledOpen || false);
    const [searchQuery, setSearchQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleOpen = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          toggleOpen();
        }
      };

      window.addEventListener("keydown", handleOpen);
      return () => window.removeEventListener("keydown", handleOpen);
    }, []);

    useEffect(() => {
      if (controlledOpen !== undefined) {
        setIsOpen(controlledOpen);
      }
    }, [controlledOpen]);

    useEffect(() => {
      if (isOpen) {
        inputRef.current?.focus();
      }
    }, [isOpen]);

    const toggleOpen = () => {
      const newOpen = !isOpen;
      setIsOpen(newOpen);
      onOpenChange?.(newOpen);
      if (!newOpen) {
        setSearchQuery("");
      }
    };

    const filteredCommands = commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const groupedCommands = filteredCommands.reduce(
      (acc, cmd) => {
        if (!acc[cmd.group]) {
          acc[cmd.group] = [];
        }
        acc[cmd.group].push(cmd);
        return acc;
      },
      {} as Record<string, Command[]>,
    );

    const sortedGroups = Object.keys(groupedCommands).sort(
      (a, b) => (groupOrder[a] ?? 999) - (groupOrder[b] ?? 999),
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const totalItems = filteredCommands.length;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[highlightedIndex]) {
            filteredCommands[highlightedIndex].action();
            toggleOpen();
          }
          break;
        case "Escape":
          e.preventDefault();
          toggleOpen();
          break;
        default:
          break;
      }
    };

    return (
      <>
        {isOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-200"
            onClick={toggleOpen}
            aria-hidden="true"
          />
        )}

        <div
          ref={containerRef}
          className={cn(
            "fixed top-0 left-0 right-0 z-50",
            "flex items-start justify-center pt-20",
            "pointer-events-none",
            isOpen && "pointer-events-auto",
          )}
        >
          <div
            ref={ref}
            className={cn(
              "w-full max-w-2xl",
              "rounded-lg shadow-2xl",
              "bg-wl-bg-primary border border-wl-border-default",
              "transition-all duration-200 ease-out",
              isOpen
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 pointer-events-none",
            )}
            {...props}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 border-b border-wl-border-default px-4 py-3">
              <Search className="w-5 h-5 text-wl-text-secondary flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className={cn(
                  "flex-1 bg-transparent text-wl-text-primary",
                  "outline-none text-base font-sans",
                  "placeholder:text-wl-text-tertiary",
                )}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleOpen}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {filteredCommands.length > 0 ? (
                sortedGroups.map((group) => (
                  <div key={group}>
                    <div className="px-4 py-2 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      {group}
                    </div>
                    <div className="space-y-0">
                      {groupedCommands[group].map((cmd, index) => {
                        const globalIndex = filteredCommands.indexOf(cmd);
                        const isHighlighted = globalIndex === highlightedIndex;

                        return (
                          <button
                            key={`${group}-${cmd.label}-${index}`}
                            onClick={() => {
                              cmd.action();
                              toggleOpen();
                            }}
                            onMouseEnter={() =>
                              setHighlightedIndex(globalIndex)
                            }
                            className={cn(
                              "w-full px-4 py-3 text-left",
                              "flex items-center justify-between gap-4",
                              "transition-colors duration-fast ease-default",
                              isHighlighted
                                ? "bg-wl-primary-500/20"
                                : "hover:bg-wl-bg-overlay",
                            )}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {cmd.icon && (
                                <span className="text-wl-text-secondary flex-shrink-0">
                                  {cmd.icon}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-wl-text-primary">
                                  {cmd.label}
                                </p>
                                {cmd.description && (
                                  <p className="text-xs text-wl-text-tertiary truncate">
                                    {cmd.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            {cmd.shortcut && (
                              <kbd className="text-xs text-wl-text-tertiary px-2 py-1 rounded border border-wl-border-default bg-wl-bg-surface flex-shrink-0">
                                {cmd.shortcut}
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-12 text-center text-sm text-wl-text-tertiary">
                  No commands found.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-wl-border-default px-4 py-2 text-xs text-wl-text-tertiary flex justify-between">
              <span>Press Escape to close</span>
              <span>Total: {filteredCommands.length}</span>
            </div>
          </div>
        </div>
      </>
    );
  },
);

CommandPalette.displayName = "CommandPalette";

export { CommandPalette };
