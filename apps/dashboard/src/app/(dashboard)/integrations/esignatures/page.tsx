'use client';

import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ESignaturesIntegrationPage() {
  return (
    <>
      <Header
        title="E-Signature Integrations"
        subtitle="Manage e-signature provider connections"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn('p-6 bg-wl-bg-root space-y-6')}>
        <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4')}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected Providers</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>e-signature services</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Envelopes Sent</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>across all providers</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Templates</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>signing templates</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Completion Rate</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>no active providers</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>E-Signature Providers</CardTitle>
          </CardHeader>
          <div className={cn('p-12 text-center')}>
            <p className={cn('text-gray-400 mb-2')}>No e-signature providers connected</p>
            <p className={cn('text-sm text-gray-500 mb-6')}>
              Connect DocuSign, Adobe Sign, HelloSign, PandaDoc, and more from the Marketplace to
              send, track, and manage e-signatures on contracts and agreements.
            </p>
            <Button variant="primary">Browse Marketplace</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Envelopes</CardTitle>
          </CardHeader>
          <div className={cn('p-12 text-center')}>
            <p className={cn('text-gray-500 text-sm')}>No envelopes yet</p>
          </div>
        </Card>
      </div>
    </>
  );
}
