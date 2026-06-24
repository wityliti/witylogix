'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApiMutation } from '@/hooks/use-api';

interface CustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export default function CreateCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState<CustomerPayload>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);

  const create = useApiMutation<{ id: string }>('POST', '/api/v4/customers');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.email.trim()) {
      setError('Email is required');
      return;
    }
    try {
      await create.execute({
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      });
      router.push('/customers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    }
  };

  const update =
    <K extends keyof CustomerPayload>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <>
      <Header
        title="Add Customer"
        subtitle="Create a new customer record"
        actions={
          <Button variant="secondary" size="md" onClick={() => router.push('/customers')}>
            Cancel
          </Button>
        }
      />
      <div className="p-6">
        <Card className="max-w-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cust-first" className="block text-sm font-medium text-zinc-200 mb-1">
                  First name
                </label>
                <input
                  id="cust-first"
                  type="text"
                  value={form.firstName}
                  onChange={update('firstName')}
                  className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label htmlFor="cust-last" className="block text-sm font-medium text-zinc-200 mb-1">
                  Last name
                </label>
                <input
                  id="cust-last"
                  type="text"
                  value={form.lastName}
                  onChange={update('lastName')}
                  className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="cust-email" className="block text-sm font-medium text-zinc-200 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                id="cust-email"
                type="email"
                value={form.email}
                onChange={update('email')}
                className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label htmlFor="cust-phone" className="block text-sm font-medium text-zinc-200 mb-1">
                Phone
              </label>
              <input
                id="cust-phone"
                type="tel"
                value={form.phone}
                onChange={update('phone')}
                className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" size="md" disabled={create.loading}>
                {create.loading ? 'Creating…' : 'Create customer'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => router.push('/customers')}
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
