import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WLMapContext } from '../wl-map-context';
import { DrawLayer } from '../draw-layer';

vi.mock('@mapbox/mapbox-gl-draw', () => ({
  default: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    changeMode: vi.fn(),
    getAll: vi.fn(() => ({ type: 'FeatureCollection', features: [] })),
  })),
}));

describe('<DrawLayer>', () => {
  it('attaches a draw control to the map when mode is set', () => {
    const addControl = vi.fn();
    const map = {
      addControl,
      removeControl: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    };
    render(
      <WLMapContext.Provider value={map as never}>
        <DrawLayer mode="polygon" value={null} onChange={() => {}} />
      </WLMapContext.Provider>,
    );
    expect(addControl).toHaveBeenCalled();
  });
});
