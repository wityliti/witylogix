"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFreightRates, useLaneAnalytics, useRateCalculator } from "@/hooks/use-freight";

/* ═══════════════════════════════════════════════════════════
   FREIGHT RATES PAGE — Rate comparison & negotiation
   ═══════════════════════════════════════════════════════════ */

export default function FreightRatesPage() {
  const { rates, selectedLane, setSelectedLane } = useFreightRates();
  const { analytics } = useLaneAnalytics();
  const { calculation, calculate } = useRateCalculator();

  const [showRFPWizard, setShowRFPWizard] = useState(false);
  const [rfpStep, setRfpStep] = useState<0 | 1 | 2 | 3>(0);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcValues, setCalcValues] = useState({ origin: "", destination: "", weight: 0, class: "FTL", equipment: "53' Dry Van" });

  // Get unique lanes
  const lanes = useMemo(() => {
    const uniqueLanes = new Map<string, { id: string; origin: string; destination: string }>();
    rates.forEach((r) => {
      if (!uniqueLanes.has(r.laneId)) {
        uniqueLanes.set(r.laneId, { id: r.laneId, origin: r.origin, destination: r.destination });
      }
    });
    return Array.from(uniqueLanes.values());
  }, [rates]);

  // Get rates for selected lane
  const laneRates = useMemo(() => {
    if (!selectedLane) return [];
    return rates.filter((r) => r.laneId === selectedLane);
  }, [rates, selectedLane]);

  // Get lane analytics
  const laneAnalytics = useMemo(() => {
    if (!selectedLane) return null;
    return analytics.find((a) => a.laneId === selectedLane) || null;
  }, [analytics, selectedLane]);

  // Rate history for chart
  const rateHistory = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      const baseRate = laneAnalytics?.avgRate ?? 2000;
      const variance = (Math.sin(i / 3) * 200) + Math.random() * 100;
      return {
        month: date.toLocaleString("default", { month: "short" }),
        contracted: Math.round(baseRate * 0.9 + variance),
        spot: Math.round(baseRate + variance),
        market: Math.round(baseRate + variance * 0.5),
      };
    });
  }, [laneAnalytics]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary">Rate Management</h2>
          <p className="text-sm text-wl-text-secondary mt-1">{lanes.length} active lanes</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="md" onClick={() => setCalculatorOpen(!calculatorOpen)}>
            📊 Calculator
          </Button>
          <Button variant="primary" size="md" onClick={() => { setShowRFPWizard(true); setRfpStep(0); }}>
            + New RFP
          </Button>
        </div>
      </div>

      {/* Rate Calculator Popup */}
      {calculatorOpen && (
        <Card className="mb-6 bg-gradient-to-br from-wl-primary-500/10 to-transparent">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-wl-text-primary">Rate Calculator</h3>
              <button onClick={() => setCalculatorOpen(false)} className="text-wl-text-tertiary text-xl">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-1">Origin</label>
                <input
                  placeholder="City, State"
                  value={calcValues.origin}
                  onChange={(e) => setCalcValues({ ...calcValues, origin: e.target.value })}
                  className="w-full p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-1">Destination</label>
                <input
                  placeholder="City, State"
                  value={calcValues.destination}
                  onChange={(e) => setCalcValues({ ...calcValues, destination: e.target.value })}
                  className="w-full p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-1">Weight (lbs)</label>
                <input
                  type="number"
                  value={calcValues.weight}
                  onChange={(e) => setCalcValues({ ...calcValues, weight: Number(e.target.value) })}
                  className="w-full p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-1">Freight Class</label>
                <select
                  value={calcValues.class}
                  onChange={(e) => setCalcValues({ ...calcValues, class: e.target.value })}
                  className="w-full p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated"
                >
                  <option>FTL</option>
                  <option>LTL</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  calculate(calcValues.origin, calcValues.destination, calcValues.weight, calcValues.class, calcValues.equipment)
                }
              >
                Calculate
              </Button>
              {calculation && (
                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-wl-border-default">
                  <span className="text-xs text-wl-text-secondary">Estimated Rate:</span>
                  <span className="text-lg font-bold text-wl-primary-400">${calculation.estimatedRate}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Lane Selection */}
      <Card className="mb-6">
        <div className="p-6 border-b border-wl-border-subtle">
          <h3 className="text-lg font-bold text-wl-text-primary mb-4">Select Lane</h3>
          <div className="grid grid-cols-auto gap-2">
            {lanes.map((lane) => (
              <button
                key={lane.id}
                onClick={() => setSelectedLane(lane.id)}
                className={cn(
                  "px-4 py-2 rounded border text-xs font-semibold transition-all whitespace-nowrap",
                  selectedLane === lane.id
                    ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                    : "bg-transparent text-wl-text-secondary border-wl-border-default hover:border-wl-primary-400"
                )}
              >
                {lane.origin} → {lane.destination}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {selectedLane && laneAnalytics && (
        <>
          {/* Lane Analytics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-xs text-wl-text-tertiary mb-1">Avg Rate</div>
              <div className="text-2xl font-bold text-wl-text-primary">${laneAnalytics.avgRate}</div>
              <div className="text-xs text-wl-text-secondary mt-1">per load</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-wl-text-tertiary mb-1">Min / Max</div>
              <div className="text-2xl font-bold text-wl-text-primary">
                ${laneAnalytics.minRate} / ${laneAnalytics.maxRate}
              </div>
              <div className="text-xs text-wl-text-secondary mt-1">range</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-wl-text-tertiary mb-1">Volume YTD</div>
              <div className="text-2xl font-bold text-wl-text-primary">{laneAnalytics.volumeYTD}</div>
              <div className="text-xs text-wl-text-secondary mt-1">loads</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-wl-text-tertiary mb-1">Trend</div>
              <div className={cn("text-2xl font-bold", laneAnalytics.trendPercent > 0 ? "text-wl-danger-400" : "text-wl-success-400")}>
                {laneAnalytics.trendPercent > 0 ? "+" : ""}
                {laneAnalytics.trendPercent.toFixed(1)}%
              </div>
              <div className="text-xs text-wl-text-secondary mt-1">vs last month</div>
            </Card>
          </div>

          {/* Rate History Chart */}
          <Card className="mb-6">
            <div className="p-6 border-b border-wl-border-subtle">
              <h3 className="text-lg font-bold text-wl-text-primary">Rate History (12 Months)</h3>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded bg-wl-primary-500" />
                  Contracted
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded bg-wl-warning-400" />
                  Spot
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded bg-wl-info-400" />
                  Market Bench
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="h-48 bg-wl-bg-surface rounded border border-wl-border-subtle flex items-end justify-between p-4 gap-2">
                {rateHistory.map((point, idx) => {
                  const maxRate = Math.max(...rateHistory.flatMap((p) => [p.contracted, p.spot, p.market]));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1" title={`${point.month}`}>
                      <div className="w-full h-24 relative flex items-end justify-around gap-0.5">
                        {[
                          { value: point.contracted, color: "bg-wl-primary-500" },
                          { value: point.spot, color: "bg-wl-warning-400" },
                          { value: point.market, color: "bg-wl-info-400" },
                        ].map((bar, bidx) => (
                          <div
                            key={bidx}
                            className={cn("flex-1 rounded-t transition-colors", bar.color)}
                            style={{ height: `${(bar.value / maxRate) * 100}%` }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-wl-text-tertiary font-mono">{point.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Carrier Rates Table */}
          <Card className="mb-6">
            <div className="p-6 border-b border-wl-border-subtle">
              <h3 className="text-lg font-bold text-wl-text-primary">Carrier Rates</h3>
              <p className="text-xs text-wl-text-tertiary mt-1">Contracted vs spot vs market benchmark</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {["Carrier", "Equipment", "Contracted", "Spot", "Market Bench", "Savings", "Valid"].map((h) => (
                      <th
                        key={h}
                        className="text-left p-4 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider border-b border-wl-border-subtle bg-wl-bg-surface whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {laneRates.map((rate) => {
                    const savings = Math.round(rate.spot - rate.contracted);
                    return (
                      <tr key={rate.id} className="border-b border-wl-border-subtle hover:bg-wl-bg-overlay transition-colors">
                        <td className="p-4 font-semibold text-wl-text-primary text-xs">{rate.carrier}</td>
                        <td className="p-4 text-wl-text-secondary text-xs">{rate.equipment}</td>
                        <td className="p-4 font-mono font-semibold text-wl-primary-400 text-xs">
                          ${rate.contracted}
                        </td>
                        <td className="p-4 font-mono font-semibold text-wl-warning-400 text-xs">
                          ${rate.spot}
                        </td>
                        <td className="p-4 font-mono text-wl-text-secondary text-xs">${rate.marketBench}</td>
                        <td className="p-4">
                          <Badge variant={savings > 0 ? "success" : "warning"}>
                            {savings > 0 ? "+" : ""} ${savings}
                          </Badge>
                        </td>
                        <td className="p-4 text-wl-text-tertiary text-xs">
                          {new Date(rate.validTo).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Active Negotiations Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <div className="p-6 border-b border-wl-border-subtle">
                  <h3 className="text-lg font-bold text-wl-text-primary">Quick Actions</h3>
                </div>
                <div className="p-6 space-y-3">
                  <Button variant="primary" size="md" className="w-full">
                    Request Quote
                  </Button>
                  <Button variant="secondary" size="md" className="w-full">
                    Send Counter-Offer
                  </Button>
                  <Button variant="ghost" size="md" className="w-full">
                    View Negotiation History
                  </Button>
                </div>
              </Card>
            </div>

            <Card>
              <div className="p-6 border-b border-wl-border-subtle">
                <h3 className="text-lg font-bold text-wl-text-primary">Negotiations</h3>
              </div>
              <div className="divide-y divide-wl-border-subtle max-h-80 overflow-y-auto">
                {[
                  { carrier: "ABC Trucking", status: "Pending", bid: "$2,150", days: 2 },
                  { carrier: "Prime Transport", status: "Counter", bid: "$2,080", days: 1 },
                  { carrier: "Swift Haul", status: "Accepted", bid: "$2,120", days: 0 },
                ].map((neg, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-wl-text-primary">{neg.carrier}</span>
                      <Badge variant={neg.status === "Accepted" ? "success" : neg.status === "Counter" ? "warning" : "info"}>
                        {neg.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-wl-primary-400">{neg.bid}</span>
                      <span className="text-wl-text-tertiary">{neg.days}d ago</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* RFP Wizard Modal */}
      {showRFPWizard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <div className="p-6 border-b border-wl-border-subtle flex items-center justify-between">
              <h3 className="text-xl font-bold text-wl-text-primary">Create RFP</h3>
              <button
                onClick={() => setShowRFPWizard(false)}
                className="text-wl-text-tertiary hover:text-wl-text-primary text-xl"
              >
                ✕
              </button>
            </div>

            {/* Steps */}
            <div className="p-6">
              <div className="flex gap-2 mb-6">
                {[0, 1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border font-semibold text-xs",
                      rfpStep === step
                        ? "bg-wl-primary-500 text-white border-wl-primary-500"
                        : rfpStep > step
                          ? "bg-wl-success-400 text-white border-wl-success-400"
                          : "bg-transparent border-wl-border-default text-wl-text-tertiary"
                    )}
                  >
                    {rfpStep > step ? "✓" : step + 1}
                  </div>
                ))}
              </div>

              {rfpStep === 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-wl-text-primary">Select Lanes</h4>
                  <div className="space-y-2">
                    {lanes.map((lane) => (
                      <label key={lane.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border border-wl-border-default" />
                        <span className="text-sm text-wl-text-secondary">
                          {lane.origin} → {lane.destination}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {rfpStep === 1 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-wl-text-primary">Volume Commitments</h4>
                  <input placeholder="Loads per month" type="number" className="w-full p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated" />
                  <input placeholder="Annual volume" type="number" className="w-full p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated" />
                </div>
              )}
              {rfpStep === 2 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-wl-text-primary">Invite Carriers</h4>
                  <input placeholder="Enter carrier names or search..." className="w-full p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated" />
                </div>
              )}
              {rfpStep === 3 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-wl-text-primary">Review & Send</h4>
                  <p className="text-sm text-wl-text-secondary">RFP will be sent to selected carriers...</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-wl-border-subtle flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowRFPWizard(false)}>
                Cancel
              </Button>
              {rfpStep > 0 && (
                <Button variant="secondary" size="sm" onClick={() => setRfpStep((s) => (s - 1) as any)}>
                  Back
                </Button>
              )}
              {rfpStep < 3 && (
                <Button variant="primary" size="sm" onClick={() => setRfpStep((s) => (s + 1) as any)}>
                  Next
                </Button>
              )}
              {rfpStep === 3 && (
                <Button variant="primary" size="sm" onClick={() => setShowRFPWizard(false)}>
                  Send RFP
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
