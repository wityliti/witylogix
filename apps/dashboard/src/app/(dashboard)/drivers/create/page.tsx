'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApiMutation } from '@/hooks/use-api';

interface DriverPayload {
  name: string;
  phone: string;
  email?: string;
  vehicleType?: string;
  licensePlate?: string;
}

export default function CreateDriverPage() {
  const router = useRouter();
  const [form, setForm] = useState<DriverPayload>({
    name: '',
    phone: '',
    email: '',
    vehicleType: 'VAN',
    licensePlate: '',
  });
  const [error, setError] = useState<string | null>(null);

  const create = useApiMutation<{ id: string }>('POST', '/api/v4/drivers');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.phone.trim()) {
      setError('Phone is required');
      return;
    }
    try {
      await create.execute({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || undefined,
        vehicleType: form.vehicleType || undefined,
        licensePlate: form.licensePlate?.trim() || undefined,
      });
      router.push('/drivers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create driver');
    }
  };

  const update =
    <K extends keyof DriverPayload>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <>
      <Header
        title="Add Driver"
        subtitle="Onboard a new driver to the fleet"
        actions={
          <Button variant="secondary" size="md" onClick={() => router.push('/drivers')}>
            Cancel
          </Button>
        }
      />
      <div className="p-6">
        <Card className="max-w-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="driver-name" className="block text-sm font-medium text-wl-text-primary mb-1">
                Full name <span className="text-red-400">*</span>
              </label>
              <input
                id="driver-name"
                type="text"
                value={form.name}
                onChange={update('name')}
                className="w-full rounded-md bg-wl-bg-surface border border-wl-border-default px-3 py-2 text-wl-text-primary focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label htmlFor="driver-phone" className="block text-sm font-medium text-wl-text-primary mb-1">
                Phone <span className="text-red-400">*</span>
              </label>
              <input
                id="driver-phone"
                type="tel"
                value={form.phone}
                onChange={update('phone')}
                className="w-full rounded-md bg-wl-bg-surface border border-wl-border-default px-3 py-2 text-wl-text-primary focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label htmlFor="driver-email" className="block text-sm font-medium text-wl-text-primary mb-1">
                Email
              </label>
              <input
                id="driver-email"
                type="email"
                value={form.email ?? ''}
                onChange={update('email')}
                className="w-full rounded-md bg-wl-bg-surface border border-wl-border-default px-3 py-2 text-wl-text-primary focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="driver-vehicle" className="block text-sm font-medium text-wl-text-primary mb-1">
                  Vehicle
                </label>
                <select
                  id="driver-vehicle"
                  value={form.vehicleType ?? 'VAN'}
                  onChange={update('vehicleType')}
                  className="w-full rounded-md bg-wl-bg-surface border border-wl-border-default px-3 py-2 text-wl-text-primary focus:outline-none focus:border-amber-500"
                >
                  <option value="VAN">Van</option>
                  <option value="TRUCK">Truck</option>
                  <option value="BIKE">Bike</option>
                  <option value="CAR">Car</option>
                </select>
              </div>
              <div>
                <label htmlFor="driver-plate" className="block text-sm font-medium text-wl-text-primary mb-1">
                  License plate
                </label>
                <input
                  id="driver-plate"
                  type="text"
                  value={form.licensePlate ?? ''}
                  onChange={update('licensePlate')}
                  className="w-full rounded-md bg-wl-bg-surface border border-wl-border-default px-3 py-2 text-wl-text-primary focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" size="md" disabled={create.loading}>
                {create.loading ? 'Creating…' : 'Create driver'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => router.push('/drivers')}
                disabled={create.loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
