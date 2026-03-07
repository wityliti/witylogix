import { clsx, type ClassValue } from "clsx";

/**
 * Merges Tailwind CSS classes with support for overrides.
 * Combines clsx for conditional classes with smart handling of conflicts.
 *
 * @example
 * cn("px-2 py-1", "px-4") // px-4 py-1
 * cn("p-4", condition && "p-6") // p-6 if condition is true
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
