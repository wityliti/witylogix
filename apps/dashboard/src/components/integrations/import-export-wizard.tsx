"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Import/Export Wizard component
 * Step-by-step data import/export wizard with file upload and preview
 * Features: file upload, column mapping, validation, progress tracking
 */

export type WizardStep = 'source' | 'mapping' | 'preview' | 'validate' | 'complete';

export type FileFormat = 'csv' | 'json' | 'xml';

export interface ImportData {
  step: WizardStep;
  fileFormat?: FileFormat;
  fileName?: string;
  columns?: string[];
  mappings?: Record<string, string>;
  previewRows?: Record<string, unknown>[];
  validationResult?: {
    isValid: boolean;
    errors: Array<{ row: number; field: string; error: string }>;
    warnings: string[];
  };
}

export interface ImportExportWizardProps {
  defaultMode?: 'import' | 'export';
  onComplete?: (data: ImportData) => void;
  className?: string;
}

export function ImportExportWizard({
  defaultMode = 'import',
  onComplete,
  className,
}: ImportExportWizardProps) {
  const [mode, setMode] = useState<'import' | 'export'>(defaultMode);
  const [data, setData] = useState<ImportData>({ step: 'source' });
  const [isProcessing, setIsProcessing] = useState(false);

  const steps: WizardStep[] = ['source', 'mapping', 'preview', 'validate', 'complete'];
  const currentStepIndex = steps.indexOf(data.step);

  const handleNext = async () => {
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsProcessing(false);

    if (data.step === 'source') {
      setData({ ...data, step: 'mapping' });
    } else if (data.step === 'mapping') {
      setData({ ...data, step: 'preview' });
    } else if (data.step === 'preview') {
      setData({ ...data, step: 'validate' });
    } else if (data.step === 'validate') {
      setData({ ...data, step: 'complete' });
    }
  };

  const handleBack = () => {
    if (data.step === 'mapping') {
      setData({ ...data, step: 'source' });
    } else if (data.step === 'preview') {
      setData({ ...data, step: 'mapping' });
    } else if (data.step === 'validate') {
      setData({ ...data, step: 'preview' });
    } else if (data.step === 'complete') {
      setData({ ...data, step: 'validate' });
    }
  };

  const handleComplete = () => {
    onComplete?.(data);
  };

  return (
    <div
      className={cn(
        'border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden flex flex-col',
        className
      )}
      style={{ height: '700px' }}
    >
      {/* Header */}
      <div className="bg-wl-surface-hover border-b border-wl-border-subtle p-6">
        <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
          Data {mode === 'import' ? 'Import' : 'Export'} Wizard
        </h2>
        <p className="text-sm text-wl-text-secondary">
          {mode === 'import'
            ? 'Follow the steps to import data from a file'
            : 'Follow the steps to export your data'}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="bg-wl-surface-hover border-b border-wl-border-subtle px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isActive = step === data.step;

            const stepLabels: Record<WizardStep, string> = {
              source: 'Source',
              mapping: 'Mapping',
              preview: 'Preview',
              validate: 'Validate',
              complete: 'Complete',
            };

            return (
              <div key={step} className="flex-1 flex items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200 flex-shrink-0',
                    isCompleted && 'bg-wl-success-100 dark:bg-wl-success-900/30 text-wl-success-700 dark:text-wl-success-300',
                    isActive && 'bg-wl-primary-100 dark:bg-wl-primary-900/30 text-wl-primary-700 dark:text-wl-primary-300 ring-2 ring-wl-primary-500/20',
                    !isCompleted && !isActive && 'bg-wl-border-subtle text-wl-text-secondary'
                  )}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>

                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-1 mx-2 rounded-full transition-all duration-200',
                      isCompleted ? 'bg-wl-success-500' : 'bg-wl-border-subtle'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="text-xs text-wl-text-secondary text-center">
          Step {currentStepIndex + 1} of {steps.length}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Source Step */}
        {data.step === 'source' && (
          <div>
            <h3 className="text-lg font-semibold text-wl-text-primary mb-4">Choose Source</h3>

            {mode === 'import' ? (
              <div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-wl-text-secondary mb-3">
                    File Format
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['csv', 'json', 'xml'] as const).map((format) => (
                      <button
                        key={format}
                        onClick={() => setData({ ...data, fileFormat: format })}
                        className={cn(
                          'p-4 rounded-lg border-2 transition-colors',
                          data.fileFormat === format
                            ? 'border-wl-primary-500 bg-wl-primary-500/5'
                            : 'border-wl-border-subtle hover:border-wl-border-default bg-wl-surface-hover'
                        )}
                      >
                        <div className="text-sm font-semibold text-wl-text-primary">{format.toUpperCase()}</div>
                        <div className="text-xs text-wl-text-secondary mt-1">
                          {format === 'csv' && 'Comma-separated values'}
                          {format === 'json' && 'JSON format'}
                          {format === 'xml' && 'XML format'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-3">
                    Select File
                  </label>
                  <div className="border-2 border-dashed border-wl-border-subtle rounded-lg p-8 text-center hover:border-wl-primary-500 transition-colors cursor-pointer">
                    <div className="text-4xl mb-3">📁</div>
                    <div className="text-sm font-medium text-wl-text-primary mb-1">
                      Click to select file or drag and drop
                    </div>
                    <div className="text-xs text-wl-text-secondary">
                      Maximum file size: 50MB
                    </div>
                    <input
                      type="file"
                      accept={
                        data.fileFormat === 'csv'
                          ? '.csv'
                          : data.fileFormat === 'json'
                            ? '.json'
                            : '.xml'
                      }
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setData({ ...data, fileName: file.name });
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                  {data.fileName && (
                    <div className="mt-3 p-3 bg-wl-success-500/10 border border-wl-success-500/20 rounded-lg">
                      <div className="text-xs text-wl-success-700 dark:text-wl-success-300">
                        ✓ File selected: {data.fileName}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {(['csv', 'json', 'xml'] as const).map((format) => (
                    <button
                      key={format}
                      onClick={() => setData({ ...data, fileFormat: format })}
                      className={cn(
                        'p-4 rounded-lg border-2 transition-colors',
                        data.fileFormat === format
                          ? 'border-wl-primary-500 bg-wl-primary-500/5'
                          : 'border-wl-border-subtle hover:border-wl-border-default bg-wl-surface-hover'
                      )}
                    >
                      <div className="text-sm font-semibold text-wl-text-primary">{format.toUpperCase()}</div>
                      <div className="text-xs text-wl-text-secondary mt-1">
                        {format === 'csv' && 'Spreadsheet'}
                        {format === 'json' && 'API-friendly'}
                        {format === 'xml' && 'Structured'}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-wl-surface-hover border border-wl-border-subtle">
                  <div className="text-sm font-medium text-wl-text-primary mb-2">Export Configuration</div>
                  <div className="space-y-2 text-xs text-wl-text-secondary">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span>Include headers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span>Include timestamps</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span>Exclude empty fields</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mapping Step */}
        {data.step === 'mapping' && (
          <div>
            <h3 className="text-lg font-semibold text-wl-text-primary mb-4">Column Mapping</h3>
            <p className="text-sm text-wl-text-secondary mb-4">
              Map columns from your file to destination fields
            </p>

            <div className="space-y-3">
              {['First Name', 'Last Name', 'Email', 'Phone'].map((column) => (
                <div key={column} className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                      Source: {column}
                    </label>
                    <div className="px-3 py-2 rounded bg-wl-surface-hover text-sm text-wl-text-primary">
                      {column}
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="text-wl-text-secondary">→</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                      Target
                    </label>
                    <select
                      className={cn(
                        'w-full px-3 py-2 rounded border border-wl-border-subtle',
                        'bg-wl-bg-surface text-wl-text-primary text-sm',
                        'focus:outline-none focus:border-wl-primary-500'
                      )}
                    >
                      <option value="">Select field...</option>
                      <option value="first_name">First Name</option>
                      <option value="last_name">Last Name</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview Step */}
        {data.step === 'preview' && (
          <div>
            <h3 className="text-lg font-semibold text-wl-text-primary mb-4">Preview Data</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-subtle">
                    <th className="text-left p-3 font-semibold text-wl-text-primary">First Name</th>
                    <th className="text-left p-3 font-semibold text-wl-text-primary">Last Name</th>
                    <th className="text-left p-3 font-semibold text-wl-text-primary">Email</th>
                    <th className="text-left p-3 font-semibold text-wl-text-primary">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map((idx) => (
                    <tr key={idx} className="border-b border-wl-border-subtle hover:bg-wl-surface-hover">
                      <td className="p-3 text-wl-text-secondary">John</td>
                      <td className="p-3 text-wl-text-secondary">Doe</td>
                      <td className="p-3 text-wl-text-secondary">john@example.com</td>
                      <td className="p-3 text-wl-text-secondary">+1 555-0123</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-xs text-wl-text-secondary">
              Showing 3 of 1,250 rows to be imported
            </div>
          </div>
        )}

        {/* Validation Step */}
        {data.step === 'validate' && (
          <div>
            <h3 className="text-lg font-semibold text-wl-text-primary mb-4">Validation Results</h3>

            <div className="space-y-3 mb-6">
              <div className="p-4 rounded-lg bg-wl-success-500/10 border border-wl-success-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-wl-success-500" />
                  <div className="font-semibold text-wl-success-700 dark:text-wl-success-300">1,200 records valid</div>
                </div>
                <div className="text-xs text-wl-text-secondary">
                  All required fields are populated and data types match
                </div>
              </div>

              <div className="p-4 rounded-lg bg-wl-warning-500/10 border border-wl-warning-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-wl-warning-500" />
                  <div className="font-semibold text-wl-warning-700 dark:text-wl-warning-300">50 warnings</div>
                </div>
                <div className="text-xs text-wl-text-secondary">
                  Some records have incomplete data (email addresses will be required)
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-wl-surface-hover border border-wl-border-subtle">
              <div className="text-sm font-semibold text-wl-text-primary mb-2">Summary</div>
              <div className="space-y-1 text-xs text-wl-text-secondary">
                <div>Total records: 1,250</div>
                <div>Valid: 1,200 (96%)</div>
                <div>Warnings: 50 (4%)</div>
                <div>Estimated import time: 2 minutes</div>
              </div>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {data.step === 'complete' && (
          <div className="text-center">
            <div className="text-6xl mb-4">✓</div>
            <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
              {mode === 'import' ? 'Import Complete' : 'Export Complete'}
            </h3>
            <p className="text-sm text-wl-text-secondary mb-6">
              {mode === 'import'
                ? '1,200 records have been successfully imported'
                : 'Your data has been exported successfully'}
            </p>

            <div className="p-4 rounded-lg bg-wl-success-500/10 border border-wl-success-500/20 mb-6">
              <div className="text-xs text-wl-text-secondary">
                {mode === 'import' ? 'Next steps: Review the imported data' : 'Download your file from the notification'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-wl-border-subtle bg-wl-surface-hover p-6 flex gap-3">
        <button
          onClick={handleBack}
          disabled={data.step === 'source' || isProcessing}
          className={cn(
            'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
            'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          Back
        </button>

        {data.step !== 'complete' && (
          <button
            onClick={handleNext}
            disabled={
              isProcessing ||
              (data.step === 'source' && !data.fileFormat) ||
              (data.step === 'source' && mode === 'import' && !data.fileName)
            }
            className={cn(
              'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              'bg-wl-primary-500 text-white hover:bg-wl-primary-600',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isProcessing ? 'Processing...' : 'Next'}
          </button>
        )}

        {data.step === 'complete' && (
          <button
            onClick={handleComplete}
            className={cn(
              'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              'bg-wl-primary-500 text-white hover:bg-wl-primary-600'
            )}
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
