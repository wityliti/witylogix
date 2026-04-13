'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useApiQuery } from '@/hooks/use-api';
import {
  useMigrations,
  useMigrationWizard,
  useShadowMode,
  type FieldMapping,
  type Migration,
  type MigrationValidation,
  type ShadowModeComparison,
} from '@/hooks/use-migration';

const PROVIDERS = ['Stripe', 'PayPal', 'Square', 'Adyen', 'AWS S3', 'Google Pay'];

const COMPATIBILITY_MATRIX: Record<string, string[]> = {
  Stripe: ['PayPal', 'Square', 'Adyen'],
  PayPal: ['Stripe', 'Square', 'Adyen'],
  Square: ['Stripe', 'PayPal', 'Adyen'],
  Adyen: ['Stripe', 'PayPal', 'Square'],
  'AWS S3': ['Google Cloud Storage'],
  'Google Pay': ['Apple Pay'],
};

const SAMPLE_FIELDS = {
  Stripe: [
    { name: 'customer_id', type: 'string' },
    { name: 'payment_method', type: 'string' },
    { name: 'amount', type: 'number' },
    { name: 'currency', type: 'string' },
  ],
  PayPal: [
    { name: 'paypal_id', type: 'string' },
    { name: 'payment_source', type: 'string' },
    { name: 'value', type: 'number' },
    { name: 'currency_code', type: 'string' },
  ],
  Square: [
    { name: 'customer_ref_id', type: 'string' },
    { name: 'payment_source_id', type: 'string' },
    { name: 'amount_money', type: 'number' },
    { name: 'currency', type: 'string' },
  ],
};

export default function MigrationWizard() {
  const [activeTab, setActiveTab] = useState<'wizard' | 'progress' | 'history'>('wizard');
  const [selectedMigration, setSelectedMigration] = useState<string | null>(null);

  const {
    currentStep,
    moveToStep,
    sourceProvider,
    setSourceProvider,
    targetProvider,
    setTargetProvider,
    fieldMappings,
    updateFieldMappings,
    shadowModeEnabled,
    setShadowModeEnabled,
    validation,
    validateMigration,
    startMigration,
  } = useMigrationWizard();

  const { migrations } = useMigrations();
  const { comparisons, matchPercentage } = useShadowMode(selectedMigration || '');

  const compatibleTargets = COMPATIBILITY_MATRIX[sourceProvider] || [];

  const handleNext = async () => {
    if (currentStep === 3) {
      await validateMigration();
    }
    if (currentStep < 5) {
      moveToStep((currentStep + 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  const handleStartMigration = async () => {
    const migration = await startMigration();
    setSelectedMigration(migration.id);
    setActiveTab('progress');
  };

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-[#1e1e2e] bg-[#0a0a0f] px-8 py-6">
        <h1 className="text-3xl font-bold text-white">Migration Wizard</h1>
        <p className="mt-2 text-white">
          Safely migrate between payment and integration providers
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#1e1e2e] px-8">
        <div className="flex gap-8">
          {(['wizard', 'progress', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-[#1e1e2e] text-white'
                  : 'border-transparent text-white hover:text-white'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {activeTab === 'wizard' && (
          <div className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-between">
              {([1, 2, 3, 4, 5] as const).map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => moveToStep(step)}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-colors',
                      currentStep >= step
                        ? 'bg-[#0a0a0f] text-white'
                        : 'bg-[#0a0a0f] text-white'
                    )}
                  >
                    {step}
                  </button>
                  {step < 5 && (
                    <div
                      className={cn(
                        'mx-2 h-1 w-12',
                        currentStep > step ? 'bg-[#0a0a0f]' : 'bg-[#0a0a0f]'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">
                {currentStep === 1 && 'Select Source Provider'}
                {currentStep === 2 && 'Select Target Provider'}
                {currentStep === 3 && 'Configure Field Mapping'}
                {currentStep === 4 && 'Enable Shadow Mode'}
                {currentStep === 5 && 'Review & Cutover'}
              </h2>
            </div>

            {/* Step Content */}
            {currentStep === 1 && (
              <ProviderSelection
                providers={PROVIDERS}
                selected={sourceProvider}
                onSelect={setSourceProvider}
                title="Select Source Provider"
              />
            )}

            {currentStep === 2 && (
              <ProviderSelection
                providers={compatibleTargets}
                selected={targetProvider}
                onSelect={setTargetProvider}
                title="Select Compatible Target Provider"
              />
            )}

            {currentStep === 3 && (
              <FieldMappingEditor
                sourceProvider={sourceProvider}
                targetProvider={targetProvider}
                mappings={fieldMappings}
                onMappingsChange={updateFieldMappings}
                validation={validation}
              />
            )}

            {currentStep === 4 && (
              <ShadowModeSettings
                enabled={shadowModeEnabled}
                onToggle={setShadowModeEnabled}
                matchPercentage={matchPercentage}
                comparisons={comparisons}
              />
            )}

            {currentStep === 5 && (
              <ReviewCutover
                sourceProvider={sourceProvider}
                targetProvider={targetProvider}
                shadowModeEnabled={shadowModeEnabled}
                fieldMappings={fieldMappings}
              />
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="secondary"
                onClick={() => moveToStep(Math.max(1, currentStep - 1) as 1 | 2 | 3 | 4 | 5)}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              {currentStep === 5 ? (
                <Button variant="primary" onClick={handleStartMigration}>
                  Start Migration
                </Button>
              ) : (
                <Button variant="primary" onClick={handleNext}>
                  Next
                </Button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'progress' && selectedMigration && (
          <MigrationProgress migrationId={selectedMigration} />
        )}

        {activeTab === 'history' && (
          <MigrationHistory migrations={migrations} />
        )}
      </div>
    </div>
  );
}

function ProviderSelection({
  providers,
  selected,
  onSelect,
  title,
}: {
  providers: string[];
  selected: string;
  onSelect: (provider: string) => void;
  title: string;
}) {
  return (
    <Card className="border border-[#1e1e2e] bg-[#0a0a0f] p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {providers.map((provider) => (
          <button
            key={provider}
            onClick={() => onSelect(provider)}
            className={cn(
              'rounded-lg border-2 px-4 py-6 text-center font-medium transition-all',
              selected === provider
                ? 'border-[#1e1e2e] bg-[#0a0a0f] bg-opacity-10 text-white'
                : 'border-[#1e1e2e] text-white hover:border-[#1e1e2e]'
            )}
          >
            {provider}
          </button>
        ))}
      </div>
    </Card>
  );
}

function FieldMappingEditor({
  sourceProvider,
  targetProvider,
  mappings,
  onMappingsChange,
  validation,
}: {
  sourceProvider: string;
  targetProvider: string;
  mappings: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
  validation: MigrationValidation | null;
}) {
  const sourceFields = SAMPLE_FIELDS[sourceProvider as keyof typeof SAMPLE_FIELDS] || [];
  const targetFields = SAMPLE_FIELDS[targetProvider as keyof typeof SAMPLE_FIELDS] || [];

  const handleAddMapping = () => {
    onMappingsChange([
      ...mappings,
      { sourceField: '', targetField: '', required: false },
    ]);
  };

  const handleUpdateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    onMappingsChange(newMappings);
  };

  return (
    <Card className="border border-[#1e1e2e] bg-[#0a0a0f] p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Field Mapping</h3>
      <div className="space-y-4">
        {mappings.length === 0 ? (
          <p className="text-sm text-white">No mappings configured yet.</p>
        ) : (
          mappings.map((mapping, idx) => (
            <div key={idx} className="flex items-end gap-3 rounded bg-[#0a0a0f] p-4">
              <div className="flex-1">
                <Label className="text-sm text-white">Source Field</Label>
                <Select
                  value={mapping.sourceField}
                  onValueChange={(value) => handleUpdateMapping(idx, { sourceField: value })}
                >
                  <SelectTrigger className="mt-1 bg-[#0a0a0f] text-white">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceFields.map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.name} ({field.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-sm text-white">Target Field</Label>
                <Select
                  value={mapping.targetField}
                  onValueChange={(value) => handleUpdateMapping(idx, { targetField: value })}
                >
                  <SelectTrigger className="mt-1 bg-[#0a0a0f] text-white">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetFields.map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.name} ({field.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={mapping.required}
                  onCheckedChange={(checked) =>
                    handleUpdateMapping(idx, { required: checked as boolean })
                  }
                />
                <Label className="text-sm text-white">Required</Label>
              </div>
            </div>
          ))
        )}
        <Button variant="secondary" onClick={handleAddMapping}>
          Add Mapping
        </Button>
      </div>
    </Card>
  );
}

function ShadowModeSettings({
  enabled,
  onToggle,
  matchPercentage,
  comparisons,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  matchPercentage: number;
  comparisons: ShadowModeComparison[];
}) {
  return (
    <Card className="border border-[#1e1e2e] bg-[#0a0a0f] p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Shadow Mode</h3>
            <p className="mt-1 text-sm text-white">
              Run both providers in parallel and compare responses
            </p>
          </div>
          <Checkbox checked={enabled} onCheckedChange={onToggle} />
        </div>

        {enabled && comparisons.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-white">Match Rate</span>
              <Badge variant="success">{matchPercentage}%</Badge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#0a0a0f]">
              <div
                className="h-full bg-[#0a0a0f] transition-all"
                style={{ width: `${matchPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ReviewCutover({
  sourceProvider,
  targetProvider,
  shadowModeEnabled,
  fieldMappings,
}: {
  sourceProvider: string;
  targetProvider: string;
  shadowModeEnabled: boolean;
  fieldMappings: FieldMapping[];
}) {
  return (
    <Card className="border border-[#1e1e2e] bg-[#0a0a0f] p-6">
      <h3 className="mb-6 text-lg font-semibold text-white">Review Migration Plan</h3>
      <div className="space-y-4">
        <div className="rounded bg-[#0a0a0f] p-4">
          <div className="text-sm text-white">Source Provider</div>
          <div className="text-lg font-semibold text-white">{sourceProvider}</div>
        </div>
        <div className="rounded bg-[#0a0a0f] p-4">
          <div className="text-sm text-white">Target Provider</div>
          <div className="text-lg font-semibold text-white">{targetProvider}</div>
        </div>
        <div className="rounded bg-[#0a0a0f] p-4">
          <div className="text-sm text-white">Shadow Mode</div>
          <div className="text-lg font-semibold text-white">
            {shadowModeEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
        <div className="rounded bg-[#0a0a0f] p-4">
          <div className="text-sm text-white">Field Mappings</div>
          <div className="mt-2 space-y-1">
            {fieldMappings.map((mapping, idx) => (
              <div key={idx} className="text-sm text-white">
                {mapping.sourceField} → {mapping.targetField}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MigrationProgress({ migrationId }: { migrationId: string }) {
  return (
    <Card className="border border-[#1e1e2e] bg-[#0a0a0f] p-6">
      <h3 className="mb-6 text-lg font-semibold text-white">Migration in Progress</h3>
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-white">Overall Progress</span>
            <span className="text-sm font-semibold text-white">65%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#0a0a0f]">
            <div className="h-full w-2/3 bg-[#0a0a0f]" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Requests Migrated" value="2,450 / 3,750" />
          <MetricCard label="Error Rate" value="0.2%" />
          <MetricCard label="Latency Δ" value="+12ms" />
        </div>

        <Button variant="danger">Rollback to Source</Button>
      </div>
    </Card>
  );
}

function MigrationHistory({ migrations }: { migrations: Migration[] }) {
  return (
    <Card className="border border-[#1e1e2e] bg-[#0a0a0f] p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Migration History</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2e]">
              <th className="px-4 py-2 text-left text-white">Source</th>
              <th className="px-4 py-2 text-left text-white">Target</th>
              <th className="px-4 py-2 text-left text-white">Status</th>
              <th className="px-4 py-2 text-left text-white">Progress</th>
              <th className="px-4 py-2 text-left text-white">Error Rate</th>
            </tr>
          </thead>
          <tbody>
            {migrations.map((migration) => (
              <tr key={migration.id} className="border-b border-[#1e1e2e]">
                <td className="px-4 py-2 text-white">{migration.sourceProvider}</td>
                <td className="px-4 py-2 text-white">{migration.targetProvider}</td>
                <td className="px-4 py-2">
                  <Badge variant={migration.status as any}>{migration.status}</Badge>
                </td>
                <td className="px-4 py-2 text-white">{migration.progress}%</td>
                <td className="px-4 py-2 text-white">
                  {(migration.errorRate * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#1e1e2e] bg-[#0a0a0f] p-4">
      <div className="text-xs text-white">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  );
}
