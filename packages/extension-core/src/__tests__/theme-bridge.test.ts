import { describe, it, expect } from "vitest";
import { getCachedOrDefaultThemes } from "../theme-bridge";

describe("getCachedOrDefaultThemes", () => {
  it("returns default theme tokens when no cached tokens exist", () => {
    const tokens = getCachedOrDefaultThemes();

    expect(tokens).toBeDefined();
    expect(tokens.colorScheme).toBe("dark");
    expect(tokens.colors).toBeDefined();
    expect(tokens.spacing).toBeDefined();
    expect(tokens.typography).toBeDefined();
    expect(tokens.radii).toBeDefined();
  });

  it("returns correct default primary color scale", () => {
    const tokens = getCachedOrDefaultThemes();

    expect(tokens.colors.primary[500]).toBe("#f5a623");
    expect(tokens.colors.primary[50]).toBe("#fff9eb");
    expect(tokens.colors.primary[900]).toBe("#6b4203");
  });

  it("returns correct default spacing values", () => {
    const tokens = getCachedOrDefaultThemes();

    expect(tokens.spacing[0]).toBe("0");
    expect(tokens.spacing[4]).toBe("1rem");
    expect(tokens.spacing[12]).toBe("3rem");
  });

  it("returns correct default typography values", () => {
    const tokens = getCachedOrDefaultThemes();

    expect(tokens.typography.weights.normal).toBe(400);
    expect(tokens.typography.weights.bold).toBe(700);
    expect(tokens.typography.sizes.base).toBe("0.875rem");
  });

  it("returns correct default radii values", () => {
    const tokens = getCachedOrDefaultThemes();

    expect(tokens.radii.sm).toBe("4px");
    expect(tokens.radii.md).toBe("8px");
    expect(tokens.radii.lg).toBe("12px");
    expect(tokens.radii.full).toBe("9999px");
  });

  it("returns correct semantic color scales", () => {
    const tokens = getCachedOrDefaultThemes();

    expect(tokens.colors.success[500]).toBe("#10b981");
    expect(tokens.colors.warning[500]).toBe("#f59e0b");
    expect(tokens.colors.danger[500]).toBe("#ef4444");
    expect(tokens.colors.info[500]).toBe("#3b82f6");
  });
});
