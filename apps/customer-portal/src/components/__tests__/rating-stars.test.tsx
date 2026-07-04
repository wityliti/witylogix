import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RatingStars } from "../rating-stars";

describe("RatingStars", () => {
  it("renders 5 star buttons", () => {
    render(<RatingStars value={0} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
  });

  it("fills correct number of stars based on value", () => {
    const { container } = render(<RatingStars value={3} />);

    const stars = container.querySelectorAll("svg");
    expect(stars).toHaveLength(5);

    // First 3 should be filled
    for (let i = 0; i < 3; i++) {
      expect(stars[i]).toHaveClass("fill-wl-warning-500");
    }
    // Last 2 should be unfilled
    for (let i = 3; i < 5; i++) {
      expect(stars[i]).not.toHaveClass("fill-wl-warning-500");
      expect(stars[i]).toHaveClass("text-wl-neutral-600");
    }
  });

  it("calls onChange when a star is clicked (non-readonly)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RatingStars value={2} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Rate 4 stars" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("calls onChange with 1 for first star", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RatingStars value={0} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Rate 1 star" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("buttons are disabled when readonly", () => {
    render(<RatingStars value={3} readonly />);
    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it("does not call onChange when readonly", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RatingStars value={3} onChange={onChange} readonly />);

    // Click is on a disabled button, so onChange should not be called
    const button = screen.getByRole("button", { name: "Rate 4 stars" });
    await user.click(button).catch(() => {
      // userEvent may throw on disabled buttons; that's fine
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("has accessible group role with label", () => {
    render(<RatingStars value={2} />);
    expect(screen.getByRole("group", { name: "Rating" })).toBeInTheDocument();
  });

  it("each star button has correct aria-label", () => {
    render(<RatingStars value={0} />);
    expect(
      screen.getByRole("button", { name: "Rate 1 star" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rate 2 stars" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rate 3 stars" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rate 4 stars" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rate 5 stars" }),
    ).toBeInTheDocument();
  });

  it("renders value 0 with no filled stars", () => {
    const { container } = render(<RatingStars value={0} />);
    const filledStars = container.querySelectorAll(".fill-wl-warning-500");
    expect(filledStars).toHaveLength(0);
  });

  it("renders value 5 with all stars filled", () => {
    const { container } = render(<RatingStars value={5} />);
    const filledStars = container.querySelectorAll(".fill-wl-warning-500");
    expect(filledStars).toHaveLength(5);
  });
});
