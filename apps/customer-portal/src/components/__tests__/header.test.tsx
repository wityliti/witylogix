import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Header } from "../header";

describe("Header", () => {
  it("renders customer name", () => {
    render(<Header customerName="Jane Smith" />);
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders default customer name when none provided", () => {
    render(<Header />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders initials avatar from customer name", () => {
    render(<Header customerName="Jane Smith" />);
    expect(screen.getByText("JS")).toBeInTheDocument();
  });

  it("renders initials avatar with default name", () => {
    render(<Header />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("shows notification bell button", () => {
    render(<Header />);
    const bellButton = screen.getByRole("button", { name: "Notifications" });
    expect(bellButton).toBeInTheDocument();
  });

  it("has mobile menu button", () => {
    render(<Header />);
    const menuButton = screen.getByRole("button", { name: "Toggle menu" });
    expect(menuButton).toBeInTheDocument();
  });

  it("calls onMenuClick when mobile menu button is clicked", async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();
    render(<Header onMenuClick={onMenuClick} />);

    await user.click(screen.getByRole("button", { name: "Toggle menu" }));
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it("profile button is accessible", () => {
    render(<Header />);
    const profileButton = screen.getByRole("button", { name: "Profile menu" });
    expect(profileButton).toBeInTheDocument();
  });

  it("renders as a sticky header element", () => {
    render(<Header />);
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("sticky");
  });
});
