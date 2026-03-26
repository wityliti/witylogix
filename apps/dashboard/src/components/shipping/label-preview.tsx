'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Printer,
  Copy,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface ShipmentLabel {
  id: string;
  trackingNumber: string;
  labelUrl?: string;
  format: 'PDF' | 'ZPL' | 'PNG';
  status: 'created' | 'voided';
  createdAt: Date;
  carrier: string;
  weight?: number;
}

interface LabelPreviewProps extends HTMLAttributes<HTMLDivElement> {
  /** Shipping label data */
  label: ShipmentLabel;
  /** Callback when print is clicked */
  onPrint?: () => void;
  /** Callback when download is clicked */
  onDownload?: (format: 'PDF' | 'PNG' | 'ZPL') => void;
  /** Callback when label is voided */
  onVoid?: () => void;
}

/**
 * Shipping label preview and download component
 *
 * Displays label image preview with download, print, and tracking number copy actions.
 * Shows status indicators for label creation and void states.
 *
 * @example
 * ```tsx
 * <LabelPreview
 *   label={label}
 *   onDownload={(format) => downloadLabel(label.id, format)}
 *   onPrint={() => printLabel(label.id)}
 * />
 * ```
 */
const LabelPreview = forwardRef<HTMLDivElement, LabelPreviewProps>(
  (
    {
      label,
      onPrint,
      onDownload,
      onVoid,
      className,
      ...props
    },
    ref
  ) => {
    const handleCopyTracking = async () => {
      try {
        await navigator.clipboard.writeText(label.trackingNumber);
      } catch (err) {
        console.error('Failed to copy tracking number:', err);
      }
    };

    const isVoided = label.status === 'voided';

    return (
      <div
        ref={ref}
        className={cn('space-y-4', className)}
        {...props}
      >
        {/* Status section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isVoided ? (
              <Badge variant="danger">
                <AlertCircle size={12} />
                Voided
              </Badge>
            ) : (
              <Badge variant="success">
                <CheckCircle size={12} />
                Label Created
              </Badge>
            )}
          </div>

          <p className="text-xs text-wl-text-tertiary">
            {new Date(label.createdAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Label preview or placeholder */}
        <div
          className={cn(
            'relative w-full aspect-[8.5/11] rounded-lg border-2 border-dashed',
            'flex items-center justify-center',
            'bg-wl-bg-surface',
            isVoided
              ? 'border-wl-danger-400/30 opacity-50'
              : 'border-wl-border-default'
          )}
        >
          {label.labelUrl ? (
            <img
              src={label.labelUrl}
              alt="Shipping label preview"
              className={cn(
                'w-full h-full object-contain rounded-md',
                isVoided && 'grayscale opacity-50'
              )}
            />
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-sm text-wl-text-secondary">
                {label.format} Label Preview
              </p>
              <p className="text-xs text-wl-text-tertiary mt-1">
                {label.carrier}
              </p>
            </div>
          )}

          {isVoided && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold text-wl-danger-400/50 rotate-45">
                VOIDED
              </span>
            </div>
          )}
        </div>

        {/* Tracking number section */}
        <div className="p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-wl-text-secondary font-medium mb-1">
                TRACKING NUMBER
              </p>
              <p className="text-sm font-mono font-semibold text-wl-text-primary">
                {label.trackingNumber}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyTracking}
              className="flex-shrink-0"
              title="Copy tracking number"
            >
              <Copy size={16} />
            </Button>
          </div>
        </div>

        {/* Additional info */}
        {label.weight && (
          <div className="flex items-center justify-between text-xs text-wl-text-secondary px-3 py-2">
            <span>Weight</span>
            <span className="font-medium text-wl-text-primary">
              {label.weight} lb
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrint}
            disabled={isVoided}
            className="flex-1 sm:flex-initial gap-2"
          >
            <Printer size={16} />
            Print
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onDownload?.('PDF')}
            disabled={isVoided}
            title="Download as PDF"
            className="flex-1 sm:flex-initial gap-2"
          >
            <Download size={16} />
            PDF
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onDownload?.('PNG')}
            disabled={isVoided}
            title="Download as PNG"
            className="flex-1 sm:flex-initial gap-2"
          >
            <Download size={16} />
            PNG
          </Button>

          {label.format === 'ZPL' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDownload?.('ZPL')}
              disabled={isVoided}
              title="Download as ZPL"
              className="flex-1 sm:flex-initial gap-2"
            >
              <Download size={16} />
              ZPL
            </Button>
          )}

          {!isVoided && onVoid && (
            <Button
              variant="danger"
              size="sm"
              onClick={onVoid}
              className="flex-1 sm:flex-initial"
            >
              Void Label
            </Button>
          )}
        </div>
      </div>
    );
  }
);

LabelPreview.displayName = 'LabelPreview';

export { LabelPreview };
export type { ShipmentLabel };
