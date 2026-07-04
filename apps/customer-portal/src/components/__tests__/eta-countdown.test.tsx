import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ETACountdown } from "../eta-countdown";

describe("ETACountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading state when eta is null", () => {
    render(<ETACountdown eta={null} />);
    expect(screen.getByText("Loading ETA...")).toBeInTheDocument();
  });

  it("shows minutes remaining after timer tick", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    // After 1s tick, diff is 10m - 1s = 9m 59s, so minutesRemaining = 9
    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} routeProgress={50} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("min")).toBeInTheDocument();
  });

  it("shows remaining time string with minutes and seconds", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    // After 1s tick: 10m31s - 1s = 10m30s => "10m 30s remaining"
    const eta = new Date("2024-06-01T12:10:31");
    render(<ETACountdown eta={eta} routeProgress={50} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // The text is split across child text nodes in a <p>, use a matcher function
    const remainingText = screen.getByText((_content, element) => {
      return (
        element?.tagName === "P" && element.textContent === "10m 30s remaining"
      );
    });
    expect(remainingText).toBeInTheDocument();
  });

  it("shows route progress bar with percentage", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} routeProgress={65} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Route progress")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it('shows "On time" status for normal delivery window (3-15 min)', () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    // After 1s tick: 8m - 1s = 7m59s => minutes=7, not delayed, not early => On time
    const eta = new Date("2024-06-01T12:08:00");
    render(<ETACountdown eta={eta} routeProgress={70} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("On time")).toBeInTheDocument();
  });

  it('shows "Delayed" status when more than 15 minutes remaining', () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    // After 1s tick: 20m - 1s = 19m59s => minutes=19 > 15 => Delayed
    const eta = new Date("2024-06-01T12:20:00");
    render(<ETACountdown eta={eta} routeProgress={30} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Delayed")).toBeInTheDocument();
  });

  it('shows "Arriving soon" status when less than 3 minutes remaining', () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    // After 1s tick: 2m - 1s = 1m59s => minutes=1 (< 3 && > 0) => Arriving soon
    const eta = new Date("2024-06-01T12:02:00");
    render(<ETACountdown eta={eta} routeProgress={95} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Arriving soon")).toBeInTheDocument();
  });

  it("renders estimated arrival label", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Estimated arrival")).toBeInTheDocument();
  });

  it("defaults routeProgress to 0 when not provided", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  // ── WIT-204: Predictive ETA fields ──────────────────────────────────────

  it("shows AI badge when isAIPredicted is true and confidence >= 0.7", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} isAIPredicted etaConfidence={0.85} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("ai-badge")).toBeInTheDocument();
  });

  it("does not show AI badge when confidence is below 0.7", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} isAIPredicted etaConfidence={0.6} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId("ai-badge")).not.toBeInTheDocument();
  });

  it("does not show AI badge when isAIPredicted is false", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(
      <ETACountdown eta={eta} isAIPredicted={false} etaConfidence={0.9} />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId("ai-badge")).not.toBeInTheDocument();
  });

  it("shows confidence interval when etaConfidence is provided", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    // confidence 0.8 → interval = Math.max(1, round((1-0.8)*5)) = Math.max(1, 1) = 1m
    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} etaConfidence={0.8} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("confidence-interval")).toHaveTextContent("± 1m");
  });

  it("confidence interval is at least 1 minute for high confidence values", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    // confidence 0.99 → interval = Math.max(1, round(0.01*5)) = Math.max(1, 0) = 1m
    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} etaConfidence={0.99} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("confidence-interval")).toHaveTextContent("± 1m");
  });

  it("does not show confidence interval when etaConfidence is null", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} etaConfidence={null} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId("confidence-interval")).not.toBeInTheDocument();
  });

  it("shows delta badge when etaDeltaMinutes >= 5 (delay)", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} etaDeltaMinutes={8} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const badge = screen.getByTestId("eta-delta-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("ETA updated +8m");
  });

  it("shows delta badge when etaDeltaMinutes <= -5 (earlier)", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} etaDeltaMinutes={-7} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const badge = screen.getByTestId("eta-delta-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("ETA updated -7m");
  });

  it("does not show delta badge when delta is below threshold (< 5 min)", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} etaDeltaMinutes={3} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId("eta-delta-badge")).not.toBeInTheDocument();
  });

  it("does not show delta badge when etaDeltaMinutes is null", () => {
    const now = new Date("2024-06-01T12:00:00");
    vi.setSystemTime(now);

    const eta = new Date("2024-06-01T12:10:00");
    render(<ETACountdown eta={eta} etaDeltaMinutes={null} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId("eta-delta-badge")).not.toBeInTheDocument();
  });
});
