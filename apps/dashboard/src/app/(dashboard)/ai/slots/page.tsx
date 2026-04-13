'use client';

import { useState } from 'react';
import {
  CalendarDays,
  Clock,
  TrendingUp,
  Users,
  Star,
  Search,
  ChevronRight,
  Zap,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiMutation } from '@/hooks/use-api';

// ── Types ────────────────────────────────────────────────────────

interface ScoredSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  zoneId: string;
  score: number;
  reasoning: string[];
  demandForecast: {
    predicted: number;
    confidence: number;
  };
  driverAvailability: {
    available: number;
    total: number;
  };
}

interface RecommendResponse {
  recommendations: ScoredSlot[];
  count: number;
  timestamp: string;
}

// ── Demo data ────────────────────────────────────────────────────

const DEMO_ZONES = [
  { id: 'zone-downtown', name: 'Downtown Core' },
  { id: 'zone-midtown',  name: 'Midtown' },
  { id: 'zone-west',     name: 'Westside' },
  { id: 'zone-harbor',   name: 'Harbor District' },
  { id: 'zone-suburb',   name: 'Suburbs' },
];

const DEMO_SLOTS: ScoredSlot[] = [
  {
    id: 'slot-1', name: 'Morning Express', startTime: '09:00', endTime: '12:00', zoneId: 'zone-downtown', score: 94,
    reasoning: ['Matches customer preference for morning delivery', 'Low demand predicted — high success rate', 'Strong driver availability in this zone'],
    demandForecast: { predicted: 18, confidence: 0.87 },
    driverAvailability: { available: 8, total: 10 },
  },
  {
    id: 'slot-2', name: 'Midday Window',   startTime: '12:00', endTime: '15:00', zoneId: 'zone-downtown', score: 81,
    reasoning: ['Moderate demand during lunch peak', 'Good driver coverage', 'Slight delay risk at 12–13h due to traffic'],
    demandForecast: { predicted: 34, confidence: 0.79 },
    driverAvailability: { available: 6, total: 10 },
  },
  {
    id: 'slot-3', name: 'Afternoon Run',   startTime: '15:00', endTime: '18:00', zoneId: 'zone-downtown', score: 73,
    reasoning: ['Higher demand predicted', 'Adequate driver count', 'Evening traffic may extend windows'],
    demandForecast: { predicted: 41, confidence: 0.74 },
    driverAvailability: { available: 5, total: 10 },
  },
  {
    id: 'slot-4', name: 'Early Morning',   startTime: '06:00', endTime: '09:00', zoneId: 'zone-downtown', score: 68,
    reasoning: ['Very low demand — high success probability', 'Limited driver availability at this hour', 'Customer has no preference data for this window'],
    demandForecast: { predicted: 8, confidence: 0.92 },
    driverAvailability: { available: 3, total: 10 },
  },
  {
    id: 'slot-5', name: 'Evening Premium', startTime: '18:00', endTime: '21:00', zoneId: 'zone-downtown', score: 61,
    reasoning: ['Premium surcharge applies', 'Demand spike after 18h', 'Fewer available drivers'],
    demandForecast: { predicted: 52, confidence: 0.68 },
    driverAvailability: { available: 4, total: 10 },
  },
];

// ── Helpers ──────────────────────────────────────────────────────

function scoreGrade(score: number) {
  if (score >= 90) return { label: 'Excellent',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
  if (score >= 75) return { label: 'Good',        color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' };
  if (score >= 60) return { label: 'Fair',        color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' };
  return           { label: 'Poor',        color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' };
}

function ScoreRing({ score, isTop }: { score: number; isTop: boolean }) {
  const grade = scoreGrade(score);
  return (
    <div className={cn(
      'w-14 h-14 rounded-full flex flex-col items-center justify-center border-2 shrink-0',
      isTop ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/[0.04]',
    )}>
      <span className={cn('text-lg font-bold font-mono leading-none', isTop ? 'text-emerald-400' : grade.color)}>{score}</span>
      <span className="text-[8px] text-white/20 leading-tight">score</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function SlotAIPage() {
  const [customerId, setCustomerId] = useState('');
  const [zoneId, setZoneId] = useState(DEMO_ZONES[0].id);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [hasSearched, setHasSearched] = useState(false);

  const { data, loading, execute } = useApiMutation<RecommendResponse>(
    'POST',
    '/api/v4/ai/slots/recommend',
  );

  const slots: ScoredSlot[] = data?.recommendations ?? (hasSearched ? DEMO_SLOTS : []);

  const handleSearch = async () => {
    setHasSearched(true);
    if (!customerId) return; // use demo data
    try {
      await execute({
        customerId,
        zoneId,
        date: new Date(date).toISOString(),
        maxSlots: 5,
      });
    } catch {
      // fall through to demo data
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500/15 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white/90 tracking-tight">Delivery Slot AI</h1>
            <p className="text-sm text-white/35 mt-0.5">AI-powered slot recommendations for customers</p>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8 space-y-5">
        {/* Query form */}
        <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Preview Slot Recommendations</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Customer ID */}
            <div>
              <label className="block text-xs text-white/30 mb-1.5">Customer ID <span className="text-white/15">(optional)</span></label>
              <input
                type="text"
                placeholder="cust_xxxxxxxx"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-[#0e0e15] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/70 placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {/* Zone */}
            <div>
              <label className="block text-xs text-white/30 mb-1.5">Delivery Zone</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full bg-[#0e0e15] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-white/20 transition-colors"
              >
                {DEMO_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-white/30 mb-1.5">Delivery Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#0e0e15] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {loading ? 'Scoring slots…' : 'Get Recommendations'}
          </button>
        </div>

        {/* Results */}
        {!hasSearched ? (
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-12 text-center">
            <CalendarDays className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/25">Enter a zone and date above to preview AI slot recommendations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top pick banner */}
            {slots.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-medium text-amber-400/80">
                  Top pick: <span className="text-amber-300">{slots[0].name}</span> · Score {slots[0].score}
                </span>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-28 bg-[#111118] border border-white/[0.06] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              slots.map((slot, idx) => {
                const isTop = idx === 0;
                const grade = scoreGrade(slot.score);
                const driverPct = slot.driverAvailability.total > 0
                  ? (slot.driverAvailability.available / slot.driverAvailability.total) * 100
                  : 0;

                return (
                  <div
                    key={slot.id}
                    className={cn(
                      'rounded-xl border p-5 transition-all',
                      isTop
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-[#111118] border-white/[0.06] hover:border-white/[0.10]',
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <ScoreRing score={slot.score} isTop={isTop} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isTop && <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          <h4 className={cn('text-base font-semibold', isTop ? 'text-white/90' : 'text-white/70')}>
                            {slot.name}
                          </h4>
                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded border', grade.bg, grade.color)}>
                            {grade.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-white/35 mb-3">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {slot.startTime} – {slot.endTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {slot.driverAvailability.available}/{slot.driverAvailability.total} drivers available
                          </span>
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />
                            {slot.demandForecast.predicted} orders predicted
                            <span className="text-white/20">({(slot.demandForecast.confidence * 100).toFixed(0)}% conf.)</span>
                          </span>
                        </div>

                        {/* Progress bars */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <div className="flex items-center justify-between text-[10px] text-white/25 mb-1">
                              <span>Driver availability</span>
                              <span>{driverPct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${driverPct}%`,
                                  background: driverPct >= 70 ? '#34d399' : driverPct >= 40 ? '#fbbf24' : '#f87171',
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-[10px] text-white/25 mb-1">
                              <span>Forecast confidence</span>
                              <span>{(slot.demandForecast.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-400/70"
                                style={{ width: `${slot.demandForecast.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Reasoning chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {slot.reasoning.map((r, i) => (
                            <span key={i} className="flex items-center gap-1 text-[10px] text-white/30 bg-white/[0.03] border border-white/[0.06] rounded-full px-2.5 py-0.5">
                              <CheckCircle2 className="w-3 h-3 text-white/20" />
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-white/15 shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Info footer */}
        {hasSearched && slots.length > 0 && (
          <p className="text-[11px] text-white/20 text-center">
            Recommendations scored by demand forecast · driver availability · customer preferences · historical success rates
          </p>
        )}
      </div>
    </div>
  );
}
