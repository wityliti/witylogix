'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApiMutation } from '@/hooks/use-api';

interface ZonePayload {
  name: string;
  description: string;
  baseRate: string;
  perKmRate: string;
}

export default function CreateZonePage() {
  const router = useRouter();
  const [form, setForm] = useState<ZonePayload>({
    name: '',
    description: '',
    baseRate: '0',
    perKmRate: '0',
  });
  const [error, setError] = useState<string | null>(null);

  const create = useApiMutation<{ id: string }>('POST', '/api/v4/zones');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await create.execute({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        baseRate: Number(form.baseRate) || 0,
        perKmRate: Number(form.perKmRate) || 0,
      });
      router.push('/zones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create zone');
    }
  };

  const update =
    <K extends keyof ZonePayload>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <>
      <Header
        title="Create Zone"
        subtitle="Define a new delivery zone"
        actions={
          <Button variant="secondary" size="md" onClick={() => router.push('/zones')}>
            Cancel
          </Button>
        }
      />
      <div className="p-6">
        <Card className="max-w-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="zone-name" className="block text-sm font-medium text-zinc-200 mb-1">
                Zone name <span className="text-red-400">*</span>
              </label>
              <input
                id="zone-name"
                type="text"
                value={form.name}
                onChange={update('name')}
                className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label htmlFor="zone-desc" className="block text-sm font-medium text-zinc-200 mb-1">
                Description
              </label>
              <textarea
                id="zone-desc"
                value={form.description}
                onChange={update('description')}
                rows={3}
                className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="zone-base" className="block text-sm font-medium text-zinc-200 mb-1">
                  Base rate (USD)
                </label>
                <input
                  id="zone-base"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.baseRate}
                  onChange={update('baseRate')}
                  className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label htmlFor="zone-km" className="block text-sm font-medium text-zinc-200 mb-1">
                  Per-km rate (USD)
                </label>
                <input
                  id="zone-km"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.perKmRate}
                  onChange={update('perKmRate')}
                  className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" size="md" disabled={create.loading}>
                {create.loading ? 'Creating…' : 'Create zone'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => router.push('/zones')}
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
