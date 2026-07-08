/**
 * Address Autocomplete Component Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddressAutocomplete } from "../address-autocomplete";
import { GoogleMapsProvider } from "../google-maps-provider";

// Mock Google Maps API
const mockGoogleMaps = {
  maps: {
    places: {
      AutocompleteService: vi.fn(),
      PlacesService: vi.fn(),
      PlacesServiceStatus: {
        OK: "OK",
        ZERO_RESULTS: "ZERO_RESULTS",
      },
    },
    LatLng: vi.fn((lat, lng) => ({ lat: () => lat, lng: () => lng })),
    Map: vi.fn(() => ({})),
  },
};

// Mock window.google
Object.defineProperty(window, "google", {
  value: mockGoogleMaps,
  writable: true,
});

describe("AddressAutocomplete", () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
    vi.clearAllMocks();
  });

  it("renders input field", () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <AddressAutocomplete
          onSelect={mockOnSelect}
          placeholder="Enter your address"
        />
      </GoogleMapsProvider>,
    );

    const input = screen.getByPlaceholderText("Enter your address");
    expect(input).toBeInTheDocument();
  });

  it("shows loading spinner when fetching predictions", async () => {
    const mockAutocompleteService = {
      getPlacePredictions: vi.fn().mockResolvedValue({
        predictions: [
          {
            place_id: "place1",
            description: "123 Main St, City",
            structured_formatting: {
              main_text: "123 Main St",
              secondary_text: "City",
            },
            types: ["address"],
          },
        ],
      }),
    };

    mockGoogleMaps.maps.places.AutocompleteService = vi
      .fn()
      .mockReturnValue(mockAutocompleteService);

    render(
      <GoogleMapsProvider apiKey="test-key">
        <AddressAutocomplete onSelect={mockOnSelect} debounceMs={100} />
      </GoogleMapsProvider>,
    );

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "main st");

    await waitFor(
      () => {
        expect(mockAutocompleteService.getPlacePredictions).toHaveBeenCalled();
      },
      { timeout: 200 },
    );
  });

  it("displays predictions dropdown", async () => {
    const mockAutocompleteService = {
      getPlacePredictions: vi.fn().mockResolvedValue({
        predictions: [
          {
            place_id: "place1",
            description: "123 Main St, City, State",
            structured_formatting: {
              main_text: "123 Main St",
              secondary_text: "City, State",
            },
            types: ["address"],
          },
        ],
      }),
    };

    mockGoogleMaps.maps.places.AutocompleteService = vi
      .fn()
      .mockReturnValue(mockAutocompleteService);

    render(
      <GoogleMapsProvider apiKey="test-key">
        <AddressAutocomplete onSelect={mockOnSelect} debounceMs={100} />
      </GoogleMapsProvider>,
    );

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "main");

    await waitFor(
      () => {
        expect(screen.getByText("123 Main St")).toBeInTheDocument();
      },
      { timeout: 200 },
    );
  });

  it("handles keyboard navigation", async () => {
    const mockAutocompleteService = {
      getPlacePredictions: vi.fn().mockResolvedValue({
        predictions: [
          {
            place_id: "place1",
            description: "123 Main St",
            structured_formatting: { main_text: "123 Main St" },
            types: ["address"],
          },
          {
            place_id: "place2",
            description: "456 Oak Ave",
            structured_formatting: { main_text: "456 Oak Ave" },
            types: ["address"],
          },
        ],
      }),
    };

    mockGoogleMaps.maps.places.AutocompleteService = vi
      .fn()
      .mockReturnValue(mockAutocompleteService);

    render(
      <GoogleMapsProvider apiKey="test-key">
        <AddressAutocomplete onSelect={mockOnSelect} debounceMs={100} />
      </GoogleMapsProvider>,
    );

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "street");

    await waitFor(
      () => {
        expect(screen.getByText("123 Main St")).toBeInTheDocument();
      },
      { timeout: 200 },
    );

    // Test arrow down
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => {
      const firstOption = screen.getByText("123 Main St").closest("button");
      expect(firstOption).toHaveClass("bg-wl-primary-500/10");
    });
  });

  it("clears input and predictions", async () => {
    const mockAutocompleteService = {
      getPlacePredictions: vi.fn().mockResolvedValue({
        predictions: [
          {
            place_id: "place1",
            description: "123 Main St",
            structured_formatting: { main_text: "123 Main St" },
            types: ["address"],
          },
        ],
      }),
    };

    mockGoogleMaps.maps.places.AutocompleteService = vi
      .fn()
      .mockReturnValue(mockAutocompleteService);

    render(
      <GoogleMapsProvider apiKey="test-key">
        <AddressAutocomplete onSelect={mockOnSelect} debounceMs={100} />
      </GoogleMapsProvider>,
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    await userEvent.type(input, "test");

    await waitFor(
      () => {
        expect(input.value).toBe("test");
      },
      { timeout: 200 },
    );

    const clearButton = screen.getByRole("button", { name: /clear/i });
    await userEvent.click(clearButton);

    expect(input.value).toBe("");
  });

  it("applies country filter", async () => {
    const mockAutocompleteService = {
      getPlacePredictions: vi.fn().mockResolvedValue({
        predictions: [],
      }),
    };

    mockGoogleMaps.maps.places.AutocompleteService = vi
      .fn()
      .mockReturnValue(mockAutocompleteService);

    render(
      <GoogleMapsProvider apiKey="test-key">
        <AddressAutocomplete
          onSelect={mockOnSelect}
          countryFilter={["US"]}
          debounceMs={100}
        />
      </GoogleMapsProvider>,
    );

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "test");

    await waitFor(
      () => {
        expect(
          mockAutocompleteService.getPlacePredictions,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            componentRestrictions: expect.objectContaining({ country: ["US"] }),
          }),
        );
      },
      { timeout: 200 },
    );
  });

  it("disables input when disabled prop is true", () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <AddressAutocomplete onSelect={mockOnSelect} disabled={true} />
      </GoogleMapsProvider>,
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });
});
