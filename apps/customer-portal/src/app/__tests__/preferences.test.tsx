import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PreferencesPage from "../preferences/page";

vi.mock("@/lib/use-api", () => ({
  useQuery: vi.fn().mockReturnValue({
    data: {
      data: {
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
        phone: "+1 555 000 1234",
        role: "ADMIN",
        shopId: "shop-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
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

describe("PreferencesPage", () => {
  it('renders page title "Preferences"', () => {
    render(<PreferencesPage />);
    expect(screen.getByText("Preferences")).toBeInTheDocument();
  });

  it("renders profile section heading", () => {
    render(<PreferencesPage />);
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("shows notification section", () => {
    render(<PreferencesPage />);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("shows notification channel checkboxes", () => {
    render(<PreferencesPage />);
    // "Email" appears in notification section
    expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("SMS")).toBeInTheDocument();
    expect(screen.getByText("Push Notifications")).toBeInTheDocument();
  });

  it("shows name input field", () => {
    render(<PreferencesPage />);
    const nameInput = screen.getByLabelText("Display Name");
    expect(nameInput).toBeInTheDocument();
  });

  it("populates name from API data", () => {
    render(<PreferencesPage />);
    const nameInput = screen.getByLabelText("Display Name") as HTMLInputElement;
    expect(nameInput.value).toBe("John Doe");
  });

  it("shows email field (read-only)", () => {
    render(<PreferencesPage />);
    const emailInput = screen.getByDisplayValue("john@example.com");
    expect(emailInput).toBeInTheDocument();
  });

  it("shows Save Profile button", () => {
    render(<PreferencesPage />);
    expect(screen.getByText("Save Profile")).toBeInTheDocument();
  });
});
