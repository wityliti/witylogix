import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { ModeToggle } from '../mode-toggle';
import { OverlayControls, type OverlayState } from '../overlay-controls';
import { ZoneSearch } from '../zone-search';
import { KpiStrip } from '../kpi-strip';

describe('zones chrome', () => {
  it('ModeToggle switches between monitor and configure', () => {
    const onChange = vi.fn();
    render(<ModeToggle value="monitor" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /configure/i }));
    expect(onChange).toHaveBeenCalledWith('configure');
  });

  it('OverlayControls persists state to localStorage', () => {
    const ls = new Map<string, string>();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => ls.get(k) ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => {
      ls.set(k, v);
    });
    const state: OverlayState = { heatmap: true, sla: true, openOrders: true, hubs: true, window: '24h' };
    const onChange = vi.fn();
    render(<OverlayControls value={state} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/heatmap/i));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ heatmap: false }));
  });

  it('ZoneSearch calls onSelect with fuzzy match', () => {
    const onSelect = vi.fn();
    render(
      <ZoneSearch
        zones={[
          { id: 'a', name: 'South Hub' },
          { id: 'b', name: 'North' },
        ]}
        onSelect={onSelect}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'south' } });
    fireEvent.click(screen.getByRole('option', { name: /south hub/i }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('KpiStrip renders zone/driver/order counts and a slipping pill', () => {
    render(<KpiStrip stats={{ zones: 4, driversOnline: 13, openOrders: 47, slipping: 1 }} onClickSlipping={() => {}} />);
    expect(screen.getByText(/4 zones/)).toBeInTheDocument();
    expect(screen.getByText(/13 drivers online/)).toBeInTheDocument();
    expect(screen.getByText(/47 open orders/)).toBeInTheDocument();
    expect(screen.getByText(/1 slipping/)).toBeInTheDocument();
  });
});
