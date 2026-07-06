import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import SupportPage from "../support/page";

vi.mock("@/lib/use-api", () => ({
  useQuery: vi.fn().mockReturnValue({
    data: {
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn().mockResolvedValue({}),
    loading: false,
    error: null,
    success: false,
    reset: vi.fn(),
  }),
}));

describe("SupportPage", () => {
  it('renders page title "Support Center"', () => {
    render(<SupportPage />);
    expect(screen.getByText("Support Center")).toBeInTheDocument();
  });

  it("renders page subtitle", () => {
    render(<SupportPage />);
    expect(
      screen.getByText("Get help with your deliveries and account"),
    ).toBeInTheDocument();
  });

  it("shows 3 contact method cards (Email, Phone, Chat)", () => {
    render(<SupportPage />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
  });

  it("shows email contact details", () => {
    render(<SupportPage />);
    expect(screen.getByText("support@witylogix.com")).toBeInTheDocument();
    expect(screen.getByText("Response in 2 hours")).toBeInTheDocument();
  });

  it("shows phone contact details", () => {
    render(<SupportPage />);
    expect(screen.getByText("1-800-WITYLOG")).toBeInTheDocument();
  });

  it("shows chat contact details", () => {
    render(<SupportPage />);
    expect(screen.getByText("Live chat available")).toBeInTheDocument();
    expect(screen.getByText("During business hours")).toBeInTheDocument();
  });

  it("shows FAQ section with heading", () => {
    render(<SupportPage />);
    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
  });

  it("shows FAQ category filter buttons", () => {
    render(<SupportPage />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("shows FAQ questions by default", () => {
    render(<SupportPage />);
    expect(
      screen.getByText(/can i reschedule my delivery/i),
    ).toBeInTheDocument();
  });

  it('shows "Submit a Ticket" form section', () => {
    render(<SupportPage />);
    expect(screen.getByText("Submit a Ticket")).toBeInTheDocument();
  });

  it("shows Subject and Description fields in ticket form", () => {
    render(<SupportPage />);
    expect(screen.getByPlaceholderText("How can we help?")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Describe your issue in detail…"),
    ).toBeInTheDocument();
  });

  it('shows "My Tickets" section', () => {
    render(<SupportPage />);
    expect(screen.getByText("My Tickets")).toBeInTheDocument();
  });

  it('shows "no tickets yet" when tickets list is empty', () => {
    render(<SupportPage />);
    expect(screen.getByText(/no tickets yet/i)).toBeInTheDocument();
  });

  it("Submit button is disabled when fields are empty", () => {
    render(<SupportPage />);
    const submitBtn = screen.getByRole("button", { name: /submit ticket/i });
    expect(submitBtn).toBeDisabled();
  });
});
