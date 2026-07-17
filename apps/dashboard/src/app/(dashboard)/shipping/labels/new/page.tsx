'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useApiMutation } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { Package, Truck, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';

type Step = 'package' | 'carrier' | 'rates' | 'review';

interface CreateLabelPayload {
  destination: string;
  weight: number;
  dimensions: { length: number; width: number; height: number };
  carrier: string;
  service: string;
}

export default function CreateLabelPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>('package');
  const [formData, setFormData] = useState<CreateLabelPayload>({
    destination: '',
    weight: 0,
    dimensions: { length: 0, width: 0, height: 0 },
    carrier: 'UPS',
    service: 'Ground',
  });

  const { execute: createLabel, loading, error } = useApiMutation('POST', '/api/v4/shipments');

  const handleCreateLabel = async () => {
    try {
      await createLabel(formData);
      router.push('/shipping/labels');
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to create label', message: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <>
      <Header title="Create Shipping Label" subtitle="Step-by-step label creation" />

      <main className="min-h-screen bg-wl-bg-root p-6 max-w-2xl mx-auto">
        {/* Progress Indicator */}
        <div className="flex gap-2 mb-8">
          {(['package', 'carrier', 'rates', 'review'] as const).map((s, idx) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-colors ${
                (['package', 'carrier', 'rates', 'review'] as const).indexOf(step) >= idx
                  ? 'bg-wl-primary-500'
                  : 'bg-wl-bg-elevated'
              }`}
            />
          ))}
        </div>

        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white">{step === 'package' ? 'Package Details' : step === 'carrier' ? 'Select Carrier' : step === 'rates' ? 'Review Rates' : 'Review Order'}</CardTitle>
          </CardHeader>
          <CardContent>
            {step === 'package' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">Destination</label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="City, State"
                    className="w-full p-2 border border-wl-border-default rounded bg-wl-bg-root text-white placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">Weight (lbs)</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                    className="w-full p-2 border border-wl-border-default rounded bg-wl-bg-root text-white"
                  />
                </div>
              </div>
            )}

            {step === 'carrier' && (
              <div className="space-y-3">
                {['UPS', 'FedEx', 'USPS'].map((carrier) => (
                  <div
                    key={carrier}
                    onClick={() => setFormData({ ...formData, carrier })}
                    className={`p-3 border-2 rounded cursor-pointer transition-colors ${
                      formData.carrier === carrier ? 'border-wl-primary-500 bg-wl-primary-500/10' : 'border-wl-border-default bg-wl-bg-sunken'
                    }`}
                  >
                    <p className="font-medium text-white">{carrier}</p>
                  </div>
                ))}
              </div>
            )}

            {step === 'rates' && (
              <div className="space-y-3">
                {['Ground', 'Express', 'Overnight'].map((service) => (
                  <div
                    key={service}
                    onClick={() => setFormData({ ...formData, service })}
                    className={`p-3 border-2 rounded cursor-pointer transition-colors ${
                      formData.service === service ? 'border-wl-primary-500 bg-wl-primary-500/10' : 'border-wl-border-default bg-wl-bg-sunken'
                    }`}
                  >
                    <p className="font-medium text-white">{service}</p>
                    <p className="text-xs text-wl-text-secondary">${{ Ground: "15.00", Express: "35.00", Overnight: "65.00" }[service] ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}

            {step === 'review' && (
              <div className="space-y-4">
                <div className="p-4 bg-wl-bg-elevated rounded border border-wl-border-default">
                  <p className="text-sm text-wl-text-secondary">Destination: {formData.destination}</p>
                  <p className="text-sm text-wl-text-secondary">Weight: {formData.weight} lbs</p>
                  <p className="text-sm text-wl-text-secondary">Carrier: {formData.carrier} {formData.service}</p>
                </div>
                {error && (
                  <div className="p-3 bg-wl-danger-500/10 text-wl-danger-400 rounded flex gap-2 border border-wl-danger-500/30">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error.message}</p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              {step !== 'package' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const steps: Step[] = ['package', 'carrier', 'rates', 'review'];
                    const currentIdx = steps.indexOf(step);
                    if (currentIdx > 0) setStep(steps[currentIdx - 1]);
                  }}
                >
                  Back
                </Button>
              )}
              {step !== 'review' && (
                <Button
                  variant="primary"
                  onClick={() => {
                    const steps: Step[] = ['package', 'carrier', 'rates', 'review'];
                    const currentIdx = steps.indexOf(step);
                    if (currentIdx < steps.length - 1) setStep(steps[currentIdx + 1]);
                  }}
                >
                  Next
                </Button>
              )}
              {step === 'review' && (
                <Button variant="primary" onClick={handleCreateLabel} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Label'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
