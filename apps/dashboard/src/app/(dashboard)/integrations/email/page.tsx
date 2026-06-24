'use client';

import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function EmailIntegrationsPage() {
  return (
    <>
      <Header
        title="Email Integrations"
        subtitle="Manage email delivery providers and transactional templates"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn('p-6 bg-wl-bg-root space-y-6')}>
        <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4')}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Providers</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>configured providers</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sent Today</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>emails sent</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Delivery Rate</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>no active providers</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Templates</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>email templates</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email Providers</CardTitle>
          </CardHeader>
          <div className={cn('p-12 text-center')}>
            <p className={cn('text-gray-400 mb-2')}>No email providers configured</p>
            <p className={cn('text-sm text-gray-500 mb-6')}>
              Connect SendGrid, Mailgun, Postmark, AWS SES, Resend, and more from the Marketplace
              to send transactional emails for order confirmations, delivery updates, and alerts.
            </p>
            <Button variant="primary">Browse Marketplace</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Templates</CardTitle>
          </CardHeader>
          <div className={cn('p-12 text-center')}>
            <p className={cn('text-gray-500 text-sm')}>No templates yet</p>
          </div>
        </Card>
      </div>
    </>
  );
}
