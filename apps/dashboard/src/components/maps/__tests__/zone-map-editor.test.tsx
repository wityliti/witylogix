/**
 * Zone Map Editor Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoneMapEditor } from '../zone-map-editor';
import { GoogleMapsProvider } from '../google-maps-provider';
import type { MapZone } from '../types';

// Mock Google Maps API
const mockGoogleMaps = {
  maps: {
    Map: vi.fn(() => ({
      setZoom: vi.fn(),
      setCenter: vi.fn(),
      fitBounds: vi.fn(),
    })),
    Polygon: vi.fn(() => ({
      setMap: vi.fn(),
      getPaths: vi.fn().mockReturnValue({
        forEach: vi.fn((callback) => {
          callback({
            forEach: vi.fn((cb) => {
              cb({ lat: () => 37.7749, lng: () => -122.4194 });
            }),
          });
        }),
      }),
      addListener: vi.fn(),
      setFillColor: vi.fn(),
      setStrokeColor: vi.fn(),
    })),
    LatLng: vi.fn((lat, lng) => ({ lat: () => lat, lng: () => lng })),
    LatLngBounds: vi.fn(() => ({
      extend: vi.fn(),
    })),
    ControlPosition: {
      TOP_CENTER: 1,
      TOP_LEFT: 0,
      TOP_RIGHT: 2,
      BOTTOM_LEFT: 3,
      BOTTOM_CENTER: 4,
      BOTTOM_RIGHT: 5,
    },
    drawing: {
      DrawingManager: vi.fn(() => ({
        setMap: vi.fn(),
      })),
    },
    geometry: {
      poly: {
        containsLocation: vi.fn().mockReturnValue(false),
      },
      spherical: {
        computeDistanceBetween: vi.fn().mockReturnValue(1000),
      },
    },
  },
};

Object.defineProperty(window, 'google', {
  value: mockGoogleMaps,
  writable: true,
});

describe('ZoneMapEditor', () => {
  const mockZones: MapZone[] = [
    {
      id: 'zone1',
      name: 'Downtown',
      color: '#dc2626',
      vertices: [
        { lat: 37.7749, lng: -122.4194 },
        { lat: 37.7849, lng: -122.4094 },
        { lat: 37.7649, lng: -122.4094 },
      ],
      rate: 5.0,
    },
  ];

  const mockOnZonesChange = vi.fn();

  beforeEach(() => {
    mockOnZonesChange.mockClear();
    vi.clearAllMocks();
  });

  it('renders map container', () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
        />
      </GoogleMapsProvider>
    );

    // Check if it renders without errors
    expect(screen.getByText('Zone Editor')).toBeInTheDocument();
  });

  it('displays zone list', () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
        />
      </GoogleMapsProvider>
    );

    expect(screen.getByText('Downtown')).toBeInTheDocument();
    expect(screen.getByText('1 zone created')).toBeInTheDocument();
  });

  it('allows zone selection', async () => {
    const mockOnZoneSelect = vi.fn();

    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
          onZoneSelect={mockOnZoneSelect}
        />
      </GoogleMapsProvider>
    );

    const zoneItem = screen.getByText('Downtown').closest('div');
    expect(zoneItem).toBeInTheDocument();
  });

  it('displays color picker', () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
        />
      </GoogleMapsProvider>
    );

    expect(screen.getByText('Zone Color')).toBeInTheDocument();
  });

  it('shows undo/redo buttons', () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
        />
      </GoogleMapsProvider>
    );

    const undoButton = screen.getByRole('button', { name: /undo/i });
    const redoButton = screen.getByRole('button', { name: /redo/i });

    expect(undoButton).toBeInTheDocument();
    expect(redoButton).toBeInTheDocument();
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
  });

  it('shows export and import buttons', () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
        />
      </GoogleMapsProvider>
    );

    const exportButton = screen.getByRole('button', { name: /export/i });
    const importButton = screen.getByRole('button', { name: /import/i });

    expect(exportButton).toBeInTheDocument();
    expect(importButton).toBeInTheDocument();
  });

  it('displays check overlaps button', () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
        />
      </GoogleMapsProvider>
    );

    const checkButton = screen.getByRole('button', { name: /check overlaps/i });
    expect(checkButton).toBeInTheDocument();
  });

  it('hides controls in read-only mode', () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
          readOnly={true}
        />
      </GoogleMapsProvider>
    );

    expect(screen.queryByText('Zone Editor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });

  it('allows zone name editing', async () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
        />
      </GoogleMapsProvider>
    );

    const input = screen.getByDisplayValue('Downtown') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, 'Midtown');

    // Zone name should be updated
    expect(mockOnZonesChange).toHaveBeenCalled();
  });

  it('exports zones as GeoJSON', async () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
        />
      </GoogleMapsProvider>
    );

    const exportButton = screen.getByRole('button', { name: /export/i });

    // Mock window.URL.createObjectURL
    window.URL.createObjectURL = vi.fn();
    window.URL.revokeObjectURL = vi.fn();

    await userEvent.click(exportButton);

    // Check if download was triggered
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it('respects readOnly prop', () => {
    const { rerender } = render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
          readOnly={false}
        />
      </GoogleMapsProvider>
    );

    expect(screen.getByText('Zone Editor')).toBeInTheDocument();

    rerender(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={mockZones}
          onZonesChange={mockOnZonesChange}
          readOnly={true}
        />
      </GoogleMapsProvider>
    );

    expect(screen.queryByText('Zone Editor')).not.toBeInTheDocument();
  });

  it('displays empty state when no zones', () => {
    render(
      <GoogleMapsProvider apiKey="test-key">
        <ZoneMapEditor
          zones={[]}
          onZonesChange={mockOnZonesChange}
        />
      </GoogleMapsProvider>
    );

    expect(screen.getByText(/no zones yet/i)).toBeInTheDocument();
  });
});
